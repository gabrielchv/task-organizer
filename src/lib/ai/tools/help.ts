import { z } from "zod";
import { getDictionary } from "@/i18n";
import { defineTool } from "./types";

const TOPICS = ["taskList", "voice", "wakeWord", "export", "account"] as const;

/**
 * Answers "how do I ...?" questions about the interface.
 *
 * The previous prompt embedded every button's position in two 120-line
 * language-specific blocks, so any UI change silently made the assistant wrong.
 * Reading the same dictionary the interface renders from keeps the two in step.
 */
export function createAppHelpTool(deviceType: "mobile" | "desktop") {
  return defineTool({
    name: "get_app_help",
    description:
      "Look up how to do something in this app's interface (open the task list, record voice, " +
      "enable the wake word, export tasks, sign in). Always call this instead of guessing where " +
      "a button is.",
    schema: z.object({
      topic: z
        .enum(TOPICS)
        .describe("Which part of the interface the user is asking about."),
    }),
    execute(input, { locale }) {
      const dictionary = getDictionary(locale);
      return {
        ok: true,
        deviceType,
        instructions: dictionary.help[input.topic][deviceType],
      };
    },
  });
}
