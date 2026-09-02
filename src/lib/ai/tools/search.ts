import { z } from "zod";
import { defineTool, type ToolDefinition } from "./types";

const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const MAX_RESULTS = 5;
const TIMEOUT_MS = 8_000;

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
}

interface BraveResponse {
  web?: { results?: BraveResult[] };
}

/**
 * Web search as an ordinary declared function rather than Gemini's built-in
 * `googleSearch` tool.
 *
 * Gemini refuses a request that mixes `googleSearch` with custom function
 * declarations. The previous version worked around that by dropping structured
 * output entirely and bolting on a second model call to repair the JSON
 * afterwards. Owning the search call removes the conflict, and the result is
 * a normal tool response the model can cite.
 */
export function createWebSearchTool(apiKey: string): ToolDefinition {
  return defineTool({
    name: "web_search",
    description:
      "Search the public web for facts you do not know: opening hours, weather, news, places. " +
      "Summarize the results for the user and mention where they came from.",
    schema: z.object({
      query: z.string().min(1).max(300).describe("The search query, in the user's language."),
    }),
    async execute(input, { locale, signal }) {
      const url = new URL(BRAVE_ENDPOINT);
      url.searchParams.set("q", input.query);
      url.searchParams.set("count", String(MAX_RESULTS));
      url.searchParams.set("search_lang", locale.split("-")[0] ?? "en");

      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      const composed = signal ? AbortSignal.any([signal, timeout]) : timeout;

      try {
        const response = await fetch(url, {
          headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
          signal: composed,
        });

        if (!response.ok) {
          return { ok: false, error: `search provider returned ${response.status}` };
        }

        const body = (await response.json()) as BraveResponse;
        const results = (body.web?.results ?? []).slice(0, MAX_RESULTS).map((result) => ({
          title: result.title ?? "",
          url: result.url ?? "",
          snippet: result.description ?? "",
        }));

        return { ok: true, query: input.query, results };
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown error";
        return { ok: false, error: `search failed: ${reason}` };
      }
    },
  }) as ToolDefinition;
}
