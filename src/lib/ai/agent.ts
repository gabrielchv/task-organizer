import type { Content, GenerateContentResponse, Part, PartListUnion } from "@google/genai";
import { z } from "zod";
import type { ToolContext, ToolDefinition } from "./tools/types";

/** How many model turns a single user message may consume. */
export const MAX_TURNS = 6;
/** How many tool calls a single model turn may make. */
export const MAX_CALLS_PER_TURN = 12;

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; ok: boolean }
  | { type: "done"; text: string };

/**
 * The slice of the Gemini SDK the agent depends on. Narrow on purpose: tests
 * drive the loop with a scripted fake instead of the network.
 */
export interface ChatLike {
  sendMessageStream(params: {
    message: PartListUnion;
  }): Promise<AsyncGenerator<GenerateContentResponse>>;
}

export interface AgentRunOptions {
  chat: ChatLike;
  message: PartListUnion;
  toolsByName: ReadonlyMap<string, ToolDefinition>;
  context: ToolContext;
}

export class AgentTurnLimitError extends Error {
  constructor() {
    super(`Assistant exceeded ${MAX_TURNS} turns without producing a reply`);
    this.name = "AgentTurnLimitError";
  }
}

/**
 * Drives a real function-calling loop: stream a turn, run whatever the model
 * asked for, hand the results back as `functionResponse` parts, repeat until it
 * answers in prose.
 *
 * The previous implementation looked like this loop but never sent a
 * `functionResponse` — it re-sent the system prompt as a fresh user message and
 * hoped for JSON. That is why it needed a second model to repair the output.
 */
export async function* runAgent({
  chat,
  message,
  toolsByName,
  context,
}: AgentRunOptions): AsyncGenerator<AgentEvent> {
  let next: PartListUnion = message;
  let lastText = "";

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    const stream = await chat.sendMessageStream({ message: next });

    const calls: Array<{ id?: string | undefined; name: string; args: Record<string, unknown> }> =
      [];
    let text = "";

    for await (const chunk of stream) {
      const delta = chunk.text;
      if (delta) {
        text += delta;
        yield { type: "text", delta };
      }
      for (const call of chunk.functionCalls ?? []) {
        if (!call.name) continue;
        if (calls.length >= MAX_CALLS_PER_TURN) break;
        calls.push({ id: call.id, name: call.name, args: call.args ?? {} });
      }
    }

    if (text) lastText = text;

    if (calls.length === 0) {
      yield { type: "done", text: lastText };
      return;
    }

    const responses: Part[] = [];
    for (const call of calls) {
      yield { type: "tool_call", name: call.name, args: call.args };
      const result = await executeTool(call.name, call.args, toolsByName, context);
      yield { type: "tool_result", name: call.name, ok: result["ok"] === true };
      responses.push({
        functionResponse: {
          ...(call.id === undefined ? {} : { id: call.id }),
          name: call.name,
          response: result,
        },
      });
    }

    next = responses;
  }

  throw new AgentTurnLimitError();
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  toolsByName: ReadonlyMap<string, ToolDefinition>,
  context: ToolContext,
): Promise<Record<string, unknown>> {
  const tool = toolsByName.get(name);
  if (!tool) {
    return { ok: false, error: `unknown tool: ${name}` };
  }

  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) {
    // Handing the validation error back lets the model correct itself, which is
    // cheaper and more reliable than failing the whole request.
    return {
      ok: false,
      error: "invalid arguments",
      detail: z.prettifyError(parsed.error),
    };
  }

  try {
    return { ...(await tool.execute(parsed.data, context)) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "tool execution failed",
    };
  }
}

/** Converts stored chat history into the SDK's `Content` shape. */
export function toHistory(
  messages: ReadonlyArray<{ role: "user" | "model"; text: string }>,
): Content[] {
  return messages
    .filter((message) => message.text.trim().length > 0)
    .map((message) => ({ role: message.role, parts: [{ text: message.text }] }));
}
