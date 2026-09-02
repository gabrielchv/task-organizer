import { describe, expect, it } from "vitest";
import { chatRequestSchema, createEventParser, encodeEvent } from "./protocol";

describe("chatRequestSchema", () => {
  it("accepts a minimal text request", () => {
    const parsed = chatRequestSchema.parse({ text: "add milk", locale: "pt-BR" });

    expect(parsed.deviceType).toBe("mobile");
    expect(parsed.history).toEqual([]);
  });

  it("rejects an unknown locale", () => {
    expect(chatRequestSchema.safeParse({ text: "hi", locale: "de-DE" }).success).toBe(false);
  });

  it("rejects an oversized message", () => {
    const result = chatRequestSchema.safeParse({ text: "x".repeat(5000), locale: "en-US" });

    expect(result.success).toBe(false);
  });

  it("caps how much history a client can replay", () => {
    const history = Array.from({ length: 20 }, () => ({ role: "user" as const, text: "hi" }));

    expect(chatRequestSchema.safeParse({ text: "hi", locale: "en-US", history }).success).toBe(
      false,
    );
  });

  it("rejects a malformed guest task list", () => {
    const result = chatRequestSchema.safeParse({
      text: "hi",
      locale: "en-US",
      tasks: [{ id: "a", title: "x" }],
    });

    expect(result.success).toBe(false);
  });
});

describe("SSE round trip", () => {
  it("parses events emitted by the encoder", () => {
    const parse = createEventParser();
    const wire =
      encodeEvent({ type: "text", delta: "Hello" }) + encodeEvent({ type: "done", text: "Hello" });

    expect(parse(wire)).toEqual([
      { type: "text", delta: "Hello" },
      { type: "done", text: "Hello" },
    ]);
  });

  it("holds a partial frame until the rest arrives", () => {
    const parse = createEventParser();
    const wire = encodeEvent({ type: "text", delta: "Hi" });
    const split = Math.floor(wire.length / 2);

    expect(parse(wire.slice(0, split))).toEqual([]);
    expect(parse(wire.slice(split))).toEqual([{ type: "text", delta: "Hi" }]);
  });

  it("survives text containing newlines and braces", () => {
    const parse = createEventParser();
    const delta = "line one\nline two }{ \"quoted\"";

    expect(parse(encodeEvent({ type: "text", delta }))).toEqual([{ type: "text", delta }]);
  });

  it("skips a frame it cannot parse instead of aborting", () => {
    const parse = createEventParser();

    expect(parse(`data: {broken\n\n${encodeEvent({ type: "done", text: "ok" })}`)).toEqual([
      { type: "done", text: "ok" },
    ]);
  });
});
