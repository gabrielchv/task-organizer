import { createEventParser, type ChatStreamEvent } from "@/app/api/chat/protocol";
import type { Task } from "@/features/tasks/types";
import type { Locale } from "@/i18n/config";

export interface ChatHistoryEntry {
  role: "user" | "model";
  text: string;
}

export interface SendChatOptions {
  text?: string | undefined;
  audio?: Blob | undefined;
  history: ChatHistoryEntry[];
  locale: Locale;
  timeZone: string;
  deviceType: "mobile" | "desktop";
  /** Sent only when signed out; the server reads a signed-in user's own list. */
  tasks?: readonly Task[] | undefined;
  idToken: string | null;
  signal?: AbortSignal | undefined;
}

export class ChatRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ChatRequestError";
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

export const CHAT_ENDPOINT = "/api/chat";

/**
 * `Request` requires an absolute URL outside the browser, so the path is
 * resolved against the current origin (or a placeholder under test).
 */
function endpoint(): string {
  const origin = globalThis.location?.origin ?? "http://localhost";
  return new URL(CHAT_ENDPOINT, origin).toString();
}

export function buildRequest(options: SendChatOptions): Request {
  const payload = {
    ...(options.text === undefined ? {} : { text: options.text }),
    history: options.history,
    locale: options.locale,
    timeZone: options.timeZone,
    deviceType: options.deviceType,
    ...(options.tasks === undefined ? {} : { tasks: options.tasks }),
  };

  const headers = new Headers();
  if (options.idToken) headers.set("Authorization", `Bearer ${options.idToken}`);

  if (options.audio) {
    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    form.append("audio", options.audio, "recording");
    return new Request(endpoint(), {
      method: "POST",
      body: form,
      headers,
      ...(options.signal ? { signal: options.signal } : {}),
    });
  }

  headers.set("Content-Type", "application/json");
  return new Request(endpoint(), {
    method: "POST",
    body: JSON.stringify(payload),
    headers,
    ...(options.signal ? { signal: options.signal } : {}),
  });
}

/**
 * Streams a turn from the chat API.
 *
 * `fetchImpl` is injectable so the transport can be exercised without a server.
 */
export async function* streamChat(
  options: SendChatOptions,
  fetchImpl: typeof fetch = fetch,
): AsyncGenerator<ChatStreamEvent> {
  const response = await fetchImpl(buildRequest(options));

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new ChatRequestError(
      response.status,
      body.error?.code ?? "upstream_error",
      body.error?.message ?? "Request failed",
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    );
  }

  if (!response.body) return;

  const parse = createEventParser();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of parse(decoder.decode(value, { stream: true }))) {
        yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
