import { describe, expect, it, vi } from "vitest";
import { encodeEvent, type ChatStreamEvent } from "@/app/api/chat/protocol";
import { buildRequest, ChatRequestError, streamChat, type SendChatOptions } from "./api";

function options(overrides: Partial<SendChatOptions> = {}): SendChatOptions {
  return {
    text: "add milk",
    history: [],
    locale: "en-US",
    timeZone: "UTC",
    deviceType: "desktop",
    idToken: null,
    ...overrides,
  };
}

function sseResponse(events: ChatStreamEvent[], chunkSize = 1000): Response {
  const body = events.map(encodeEvent).join("");
  const bytes = new TextEncoder().encode(body);
  let offset = 0;

  return new Response(
    new ReadableStream({
      pull(controller) {
        if (offset >= bytes.length) {
          controller.close();
          return;
        }
        controller.enqueue(bytes.slice(offset, offset + chunkSize));
        offset += chunkSize;
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

async function collect(generator: AsyncGenerator<ChatStreamEvent>) {
  const events: ChatStreamEvent[] = [];
  for await (const event of generator) events.push(event);
  return events;
}

describe("buildRequest", () => {
  it("sends JSON for a text message", () => {
    const request = buildRequest(options());

    expect(request.headers.get("content-type")).toBe("application/json");
    expect(request.headers.get("authorization")).toBeNull();
  });

  it("attaches the ID token when signed in", () => {
    const request = buildRequest(options({ idToken: "id-token" }));

    expect(request.headers.get("authorization")).toBe("Bearer id-token");
  });

  it("sends multipart for audio and lets the browser set the boundary", () => {
    const audio = new Blob(["fake"], { type: "audio/webm" });
    const request = buildRequest(options({ text: undefined, audio }));

    expect(request.headers.get("content-type")).toMatch(/multipart\/form-data/);
  });

  it("omits the task list for a signed-in user", async () => {
    const request = buildRequest(options({ idToken: "id-token" }));
    const body = (await request.json()) as Record<string, unknown>;

    expect(body).not.toHaveProperty("tasks");
  });
});

describe("streamChat", () => {
  it("yields events in order", async () => {
    const events: ChatStreamEvent[] = [
      { type: "text", delta: "Added " },
      { type: "text", delta: "**Milk**." },
      { type: "done", text: "Added **Milk**." },
    ];
    const fetchImpl = vi.fn(async () => sseResponse(events));

    expect(await collect(streamChat(options(), fetchImpl))).toEqual(events);
  });

  it("reassembles events split across network chunks", async () => {
    const events: ChatStreamEvent[] = [
      { type: "transcription", text: "add milk" },
      { type: "done", text: "Added." },
    ];
    const fetchImpl = vi.fn(async () => sseResponse(events, 7));

    expect(await collect(streamChat(options(), fetchImpl))).toEqual(events);
  });

  it("raises a typed error carrying the retry delay for a 429", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: { code: "rate_limited", message: "Too many" } }),
          {
            status: 429,
            headers: { "Retry-After": "42", "Content-Type": "application/json" },
          },
        ),
    );

    await expect(collect(streamChat(options(), fetchImpl))).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
      retryAfterSeconds: 42,
    });
  });

  it("still raises when the error body is not JSON", async () => {
    const fetchImpl = vi.fn(async () => new Response("gateway timeout", { status: 504 }));

    await expect(collect(streamChat(options(), fetchImpl))).rejects.toBeInstanceOf(
      ChatRequestError,
    );
  });
});
