import { z } from "zod";
import { defineTool, type ToolDefinition } from "./tools/types";

export const TRANSCRIPTION_TOOL_NAME = "report_transcription";

/**
 * Registered only for audio input.
 *
 * The old design asked for a `transcription` field inside a hand-written JSON
 * envelope, which is what forced the "always return valid JSON" shouting in the
 * prompt and the repair model behind it. Making it a tool means the model
 * reports the transcript through the same validated path as everything else,
 * and the UI can show it the moment it arrives.
 */
export function createTranscriptionTool(): ToolDefinition {
  return defineTool({
    name: TRANSCRIPTION_TOOL_NAME,
    description:
      "Report what the user said in the audio, word for word, before doing anything else. " +
      "Call this exactly once per audio message.",
    schema: z.object({
      text: z
        .string()
        .min(1)
        .max(4000)
        .describe("Verbatim transcript in the language spoken. No summary, no commentary."),
    }),
    execute(input) {
      return { ok: true, text: input.text };
    },
  }) as ToolDefinition;
}
