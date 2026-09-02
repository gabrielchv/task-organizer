import { createHash, randomUUID } from "node:crypto";
import type { Part } from "@google/genai";
import { NextResponse } from "next/server";
import { TaskSession } from "@/features/tasks/session";
import { describeNow, safeTimeZone } from "@/features/tasks/dates";
import type { Task } from "@/features/tasks/types";
import { runAgent, toHistory } from "@/lib/ai/agent";
import { DEFAULT_MODEL, genAI } from "@/lib/ai/client";
import { buildSystemInstruction } from "@/lib/ai/prompt";
import { buildToolset } from "@/lib/ai/tools";
import { toFunctionDeclaration } from "@/lib/ai/tools/types";
import { createTranscriptionTool, TRANSCRIPTION_TOOL_NAME } from "@/lib/ai/transcription";
import { serverEnv } from "@/lib/env";
import { adminDb, authenticate } from "@/lib/firebase/admin";
import { persistOperations, readTasks } from "@/lib/firebase/tasks-repository";
import { requestLogger } from "@/lib/logger";
import { consumeRateLimit, POLICIES } from "@/lib/rate-limit";
import {
  ALLOWED_AUDIO_TYPES,
  chatRequestSchema,
  encodeEvent,
  MAX_AUDIO_BYTES,
  type ChatErrorCode,
  type ChatRequest,
  type ChatStreamEvent,
} from "./protocol";

export const runtime = "nodejs";
export const maxDuration = 60;

interface AudioInput {
  data: string;
  mimeType: string;
}

class RequestError extends Error {
  constructor(
    readonly code: ChatErrorCode,
    readonly status: number,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const log = requestLogger(requestId);

  try {
    const { body, audio } = await readRequest(request);
    const user = await authenticate(request);
    await enforceRateLimit(user?.uid, request);

    const timeZone = safeTimeZone(body.timeZone);
    const db = user ? adminDb() : undefined;
    const initialTasks: Task[] =
      user && db ? await readTasks(db, user.uid) : (body.tasks ?? []);

    const session = new TaskSession(initialTasks, {
      now: new Date(),
      newId: () => randomUUID(),
    });

    const { searchApiKey } = { searchApiKey: serverEnv().SEARCH_API_KEY };
    const toolset = buildToolset({ deviceType: body.deviceType, searchApiKey });
    const tools = audio
      ? [...toolset.tools, createTranscriptionTool()]
      : toolset.tools;
    const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));

    const systemInstruction = buildSystemInstruction({
      locale: body.locale,
      now: describeNow(new Date(), timeZone),
      tasks: initialTasks,
      searchEnabled: toolset.searchEnabled,
    });

    const chat = genAI().chats.create({
      model: DEFAULT_MODEL,
      history: toHistory(body.history),
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: tools.map(toFunctionDeclaration) }],
        automaticFunctionCalling: { disable: true },
        temperature: 0.4,
      },
    });

    const message: Part[] = audio
      ? [
          { text: body.text ?? "(voice message)" },
          { inlineData: { mimeType: audio.mimeType, data: audio.data } },
        ]
      : [{ text: body.text ?? "" }];

    const stream = streamResponse({
      run: runAgent({
        chat,
        message,
        toolsByName,
        context: {
          session,
          locale: body.locale,
          timeZone,
          signal: request.signal,
        },
      }),
      session,
      persist: async () => {
        if (!user || !db) return;
        await persistOperations(db, user.uid, session.tasks, session.operations);
      },
      isGuest: !user,
      onError: (error) => log.error({ err: error }, "chat stream failed"),
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    if (error instanceof RequestError) {
      log.warn({ code: error.code }, error.message);
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        {
          status: error.status,
          ...(error.retryAfterSeconds === undefined
            ? {}
            : { headers: { "Retry-After": String(error.retryAfterSeconds) } }),
        },
      );
    }

    log.error({ err: error }, "chat request failed");
    return NextResponse.json(
      { error: { code: "upstream_error", message: "Internal server error" } },
      { status: 500 },
    );
  }
}

async function readRequest(
  request: Request,
): Promise<{ body: ChatRequest; audio: AudioInput | undefined }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) {
      throw new RequestError("invalid_request", 400, "audio file is required");
    }
    if (file.size > MAX_AUDIO_BYTES) {
      throw new RequestError("payload_too_large", 413, "audio exceeds 10MB");
    }

    const mimeType = normalizeAudioType(file.type);
    const buffer = Buffer.from(await file.arrayBuffer());

    return {
      body: parseBody(form.get("payload")),
      audio: { data: buffer.toString("base64"), mimeType },
    };
  }

  return { body: parseBody(await request.text()), audio: undefined };
}

function parseBody(raw: FormDataEntryValue | string | null): ChatRequest {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new RequestError("invalid_request", 400, "request body is required");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new RequestError("invalid_request", 400, "request body is not valid JSON");
  }

  const parsed = chatRequestSchema.safeParse(json);
  if (!parsed.success) {
    throw new RequestError("invalid_request", 400, parsed.error.issues[0]?.message ?? "invalid");
  }
  return parsed.data;
}

/**
 * Maps a browser's recording type onto something Gemini accepts. iOS Safari
 * reports `audio/mp4`, Chrome `audio/webm;codecs=opus`.
 */
function normalizeAudioType(reported: string): string {
  const base = reported.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!(ALLOWED_AUDIO_TYPES as readonly string[]).includes(base)) {
    throw new RequestError("unsupported_media", 415, `unsupported audio type: ${base || "unknown"}`);
  }
  if (base === "audio/x-m4a" || base === "audio/m4a") return "audio/mp4";
  if (base === "audio/mp3") return "audio/mpeg";
  return base;
}

async function enforceRateLimit(uid: string | undefined, request: Request): Promise<void> {
  const identity = uid ?? `ip:${hashClientIp(request)}`;
  const [perMinute, perDay] = uid
    ? ([POLICIES.user, POLICIES.userDaily] as const)
    : ([POLICIES.guest, POLICIES.guestDaily] as const);

  const db = adminDb();
  for (const [suffix, policy] of [
    ["m", perMinute],
    ["d", perDay],
  ] as const) {
    const decision = await consumeRateLimit(db, `${identity}:${suffix}`, policy);
    if (!decision.allowed) {
      throw new RequestError(
        "rate_limited",
        429,
        "Too many requests",
        decision.retryAfterSeconds,
      );
    }
  }
}

/** Hashed so raw addresses are never written to Firestore or the logs. */
function hashClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

interface StreamOptions {
  run: AsyncGenerator<import("@/lib/ai/agent").AgentEvent>;
  session: TaskSession;
  persist: () => Promise<void>;
  isGuest: boolean;
  onError: (error: unknown) => void;
}

function streamResponse({
  run,
  session,
  persist,
  isGuest,
  onError,
}: StreamOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const send = (event: ChatStreamEvent) =>
        controller.enqueue(encoder.encode(encodeEvent(event)));

      try {
        for await (const event of run) {
          switch (event.type) {
            case "text":
              send({ type: "text", delta: event.delta });
              break;
            case "tool_call":
              if (event.name === TRANSCRIPTION_TOOL_NAME) {
                const text = event.args["text"];
                if (typeof text === "string") send({ type: "transcription", text });
              }
              break;
            case "tool_result":
              send({ type: "tool", name: event.name, ok: event.ok });
              break;
            case "done":
              await persist();
              // A signed-in client receives the change through its Firestore
              // listener; a guest has no listener, so it gets the list here and
              // writes it to localStorage itself.
              if (isGuest && session.changed) {
                send({ type: "tasks", tasks: [...session.tasks] });
              }
              send({ type: "done", text: event.text });
              break;
          }
        }
      } catch (error) {
        onError(error);
        send({
          type: "error",
          code: "upstream_error",
          message: "The assistant could not finish that request.",
        });
      } finally {
        controller.close();
      }
    },
  });
}
