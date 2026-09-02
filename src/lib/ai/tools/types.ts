import type { FunctionDeclaration } from "@google/genai";
import { z } from "zod";
import type { TaskSession } from "@/features/tasks/session";
import type { Locale } from "@/i18n/config";

/** Everything a tool is allowed to touch. Nothing reaches global state. */
export interface ToolContext {
  session: TaskSession;
  locale: Locale;
  timeZone: string;
  signal: AbortSignal | undefined;
}

/**
 * What a tool hands back to the model. Failures are values, not exceptions:
 * the model needs to read "that id does not exist" and correct itself, which it
 * cannot do if the turn throws.
 */
export interface ToolResult {
  ok: boolean;
  [key: string]: unknown;
}

export interface ToolDefinition<TSchema extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: TSchema;
  execute(input: z.output<TSchema>, context: ToolContext): Promise<ToolResult> | ToolResult;
}

/** Helper that keeps `execute`'s input inferred from `schema`. */
export function defineTool<TSchema extends z.ZodType>(
  definition: ToolDefinition<TSchema>,
): ToolDefinition<TSchema> {
  return definition;
}

/**
 * Converts a tool to a Gemini function declaration.
 *
 * `parametersJsonSchema` takes plain JSON Schema, so the Zod schema stays the
 * single source of truth for both the model contract and runtime validation —
 * they cannot drift apart.
 */
export function toFunctionDeclaration(tool: ToolDefinition): FunctionDeclaration {
  const jsonSchema = z.toJSONSchema(tool.schema, { io: "input", target: "draft-7" });
  if (typeof jsonSchema === "object" && jsonSchema !== null) {
    delete (jsonSchema as Record<string, unknown>)["$schema"];
  }

  return {
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: jsonSchema,
  };
}
