import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskSession } from "@/features/tasks/session";
import { createWebSearchTool } from "./search";
import type { ToolContext } from "./types";

const tool = createWebSearchTool("brave-key");

const context: ToolContext = {
  session: new TaskSession([], { now: new Date(), newId: () => "id" }),
  locale: "pt-BR",
  timeZone: "UTC",
  signal: undefined,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(implementation: typeof fetch) {
  const spy = vi.fn(implementation);
  vi.stubGlobal("fetch", spy);
  return spy;
}

function braveResponse(results: object[]) {
  return new Response(JSON.stringify({ web: { results } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("web_search", () => {
  it("sends the key in a header and the locale as the search language", async () => {
    const spy = stubFetch(async () => braveResponse([]));

    await tool.execute({ query: "farmácia aberta" }, context);

    const [request, init] = spy.mock.calls[0] ?? [];
    const url = new URL(String(request));
    expect(url.searchParams.get("q")).toBe("farmácia aberta");
    expect(url.searchParams.get("search_lang")).toBe("pt");
    expect(new Headers(init?.headers).get("x-subscription-token")).toBe("brave-key");
  });

  it("returns the results in a shape the model can cite", async () => {
    stubFetch(async () =>
      braveResponse([
        { title: "Farmácia A", url: "https://a.example", description: "Aberta 24h" },
      ]),
    );

    expect(await tool.execute({ query: "farmácia" }, context)).toEqual({
      ok: true,
      query: "farmácia",
      results: [{ title: "Farmácia A", url: "https://a.example", snippet: "Aberta 24h" }],
    });
  });

  it("tolerates a result with fields missing", async () => {
    stubFetch(async () => braveResponse([{ title: "Only a title" }]));

    const result = (await tool.execute({ query: "x" }, context)) as unknown as {
      results: Array<{ url: string; snippet: string }>;
    };

    expect(result.results[0]).toEqual({ title: "Only a title", url: "", snippet: "" });
  });

  it("reports an upstream failure instead of throwing", async () => {
    stubFetch(async () => new Response("nope", { status: 401 }));

    expect(await tool.execute({ query: "x" }, context)).toEqual({
      ok: false,
      error: "search provider returned 401",
    });
  });

  it("reports a network failure instead of failing the whole turn", async () => {
    stubFetch(async () => {
      throw new Error("ECONNREFUSED");
    });

    expect(await tool.execute({ query: "x" }, context)).toMatchObject({
      ok: false,
      error: expect.stringContaining("ECONNREFUSED") as unknown,
    });
  });

  it("caps how many results reach the model", async () => {
    stubFetch(async () =>
      braveResponse(Array.from({ length: 20 }, (_, i) => ({ title: `Result ${i}` }))),
    );

    const result = (await tool.execute({ query: "x" }, context)) as unknown as {
      results: unknown[];
    };

    expect(result.results).toHaveLength(5);
  });

  it("rejects an over-long query before making a request", () => {
    expect(tool.schema.safeParse({ query: "x".repeat(400) }).success).toBe(false);
  });
});
