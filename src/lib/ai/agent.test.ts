import { describe, expect, it, vi } from "vitest";
import type { GenerateContentResponse, Part, PartListUnion } from "@google/genai";
import { z } from "zod";
import { TaskSession } from "@/features/tasks/session";
import { AgentTurnLimitError, MAX_TURNS, runAgent, type AgentEvent } from "./agent";
import { defineTool, type ToolDefinition } from "./tools/types";

const NOW = new Date("2026-03-10T12:00:00.000Z");

interface ScriptedTurn {
  text?: string;
  calls?: Array<{ name: string; args: Record<string, unknown> }>;
}

/** Minimal stand-in for a streamed `GenerateContentResponse`. */
function chunk(text?: string, calls?: ScriptedTurn["calls"]): GenerateContentResponse {
  return { text, functionCalls: calls } as unknown as GenerateContentResponse;
}

/**
 * A chat that replays a fixed script and records what it was sent, so a test
 * can assert on the parts going back to the model.
 */
function scriptedChat(turns: ScriptedTurn[]) {
  const sent: PartListUnion[] = [];
  let index = 0;

  return {
    sent,
    sendMessageStream: vi.fn(async ({ message }: { message: PartListUnion }) => {
      sent.push(message);
      const turn = turns[index++] ?? {};
      return (async function* () {
        if (turn.text !== undefined) yield chunk(turn.text);
        if (turn.calls) yield chunk(undefined, turn.calls);
      })();
    }),
  };
}

function context(initialTitles: string[] = []) {
  let counter = 0;
  const session = new TaskSession(
    initialTitles.map((title, i) => ({
      id: `existing-${i}`,
      title,
      status: "pending" as const,
      category: "general" as const,
      date: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    })),
    { now: NOW, newId: () => `id-${++counter}` },
  );
  return {
    session,
    locale: "en-US" as const,
    timeZone: "UTC",
    signal: undefined,
  };
}

async function collect(generator: AsyncGenerator<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of generator) events.push(event);
  return events;
}

const addTool = defineTool({
  name: "add_task",
  description: "add",
  schema: z.object({ title: z.string().min(1) }),
  execute(input, { session }) {
    const outcome = session.apply({ type: "add", title: input.title });
    return outcome.ok ? { ok: true, id: outcome.task?.id } : { ok: false, error: outcome.reason };
  },
}) as ToolDefinition;

const explodingTool = defineTool({
  name: "explode",
  description: "throws",
  schema: z.object({}),
  execute() {
    throw new Error("provider is down");
  },
}) as ToolDefinition;

const toolsByName = new Map<string, ToolDefinition>([
  [addTool.name, addTool],
  [explodingTool.name, explodingTool],
]);

function functionResponses(message: PartListUnion) {
  return (message as Part[]).map((part) => part.functionResponse);
}

describe("runAgent", () => {
  it("streams a plain answer with no tool calls", async () => {
    const chat = scriptedChat([{ text: "You have nothing scheduled." }]);

    const events = await collect(
      runAgent({ chat, message: "what's on today?", toolsByName, context: context() }),
    );

    expect(events).toEqual([
      { type: "text", delta: "You have nothing scheduled." },
      { type: "done", text: "You have nothing scheduled." },
    ]);
    expect(chat.sendMessageStream).toHaveBeenCalledTimes(1);
  });

  it("executes a tool and feeds the result back as a functionResponse", async () => {
    const chat = scriptedChat([
      { calls: [{ name: "add_task", args: { title: "Dentist" } }] },
      { text: "Added **Dentist**." },
    ]);
    const ctx = context();

    const events = await collect(
      runAgent({ chat, message: "add dentist", toolsByName, context: ctx }),
    );

    expect(ctx.session.tasks.map((task) => task.title)).toEqual(["Dentist"]);
    expect(events).toContainEqual({ type: "tool_call", name: "add_task", args: { title: "Dentist" } });
    expect(events).toContainEqual({ type: "tool_result", name: "add_task", ok: true });
    expect(events.at(-1)).toEqual({ type: "done", text: "Added **Dentist**." });

    // The regression this rewrite exists for: turn two must carry a real
    // functionResponse, not a re-sent prompt.
    const secondMessage = chat.sent[1];
    expect(secondMessage).toBeDefined();
    expect(functionResponses(secondMessage as PartListUnion)).toEqual([
      { name: "add_task", response: { ok: true, id: "id-1" } },
    ]);
  });

  it("runs several calls from one turn in order", async () => {
    const chat = scriptedChat([
      {
        calls: [
          { name: "add_task", args: { title: "Milk" } },
          { name: "add_task", args: { title: "Bread" } },
        ],
      },
      { text: "Added **2 tasks**." },
    ]);
    const ctx = context();

    await collect(runAgent({ chat, message: "add milk and bread", toolsByName, context: ctx }));

    expect(ctx.session.tasks.map((task) => task.title)).toEqual(["Milk", "Bread"]);
  });

  it("hands a validation error back so the model can correct itself", async () => {
    const chat = scriptedChat([
      { calls: [{ name: "add_task", args: { title: "" } }] },
      { calls: [{ name: "add_task", args: { title: "Dentist" } }] },
      { text: "Added **Dentist**." },
    ]);
    const ctx = context();

    const events = await collect(
      runAgent({ chat, message: "add dentist", toolsByName, context: ctx }),
    );

    expect(events).toContainEqual({ type: "tool_result", name: "add_task", ok: false });
    const firstResponse = functionResponses(chat.sent[1] as PartListUnion)[0];
    expect(firstResponse?.response).toMatchObject({ ok: false, error: "invalid arguments" });
    expect(ctx.session.tasks).toHaveLength(1);
  });

  it("reports an unknown tool instead of failing the request", async () => {
    const chat = scriptedChat([
      { calls: [{ name: "send_email", args: {} }] },
      { text: "I can't do that." },
    ]);

    await collect(runAgent({ chat, message: "email my boss", toolsByName, context: context() }));

    expect(functionResponses(chat.sent[1] as PartListUnion)[0]?.response).toEqual({
      ok: false,
      error: "unknown tool: send_email",
    });
  });

  it("turns a throwing tool into a failed result", async () => {
    const chat = scriptedChat([{ calls: [{ name: "explode", args: {} }] }, { text: "Sorry." }]);

    await collect(runAgent({ chat, message: "boom", toolsByName, context: context() }));

    expect(functionResponses(chat.sent[1] as PartListUnion)[0]?.response).toEqual({
      ok: false,
      error: "provider is down",
    });
  });

  it("stops after the turn limit instead of looping forever", async () => {
    const turns = Array.from({ length: MAX_TURNS + 2 }, () => ({
      calls: [{ name: "add_task", args: { title: "Loop" } }],
    }));
    const chat = scriptedChat(turns);

    await expect(
      collect(runAgent({ chat, message: "go", toolsByName, context: context() })),
    ).rejects.toBeInstanceOf(AgentTurnLimitError);
    expect(chat.sendMessageStream).toHaveBeenCalledTimes(MAX_TURNS);
  });
});
