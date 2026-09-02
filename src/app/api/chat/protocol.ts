import { z } from "zod";
import { taskListSchema } from "@/features/tasks/schema";
import type { Task } from "@/features/tasks/types";
import { LOCALES } from "@/i18n/config";

export const MAX_TEXT_LENGTH = 4_000;
export const MAX_HISTORY_MESSAGES = 12;
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export const ALLOWED_AUDIO_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/aac",
  "audio/wav",
  "audio/x-m4a",
  "audio/m4a",
] as const;

export const chatRequestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_TEXT_LENGTH).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string().max(MAX_TEXT_LENGTH),
      }),
    )
    .max(MAX_HISTORY_MESSAGES)
    .default([]),
  locale: z.enum(LOCALES),
  timeZone: z.string().max(64).optional(),
  deviceType: z.enum(["mobile", "desktop"]).default("mobile"),
  /**
   * A guest's task list, kept in their browser. Ignored for signed-in callers,
   * whose list is read from Firestore under the uid in their token — a client
   * must never be able to name whose tasks are being edited.
   */
  tasks: taskListSchema.optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export type ChatStreamEvent =
  | { type: "transcription"; text: string }
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; ok: boolean }
  | { type: "tasks"; tasks: Task[] }
  | { type: "done"; text: string }
  | { type: "error"; code: ChatErrorCode; message: string };

export type ChatErrorCode =
  | "invalid_request"
  | "rate_limited"
  | "payload_too_large"
  | "unsupported_media"
  | "upstream_error";

export function encodeEvent(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Parses an SSE body into events. Shared with the browser so the two ends of
 * the stream cannot disagree about the format.
 */
export function createEventParser(): (chunk: string) => ChatStreamEvent[] {
  let buffer = "";

  return (chunk: string) => {
    buffer += chunk;
    const events: ChatStreamEvent[] = [];
    let boundary = buffer.indexOf("\n\n");

    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      const payload = frame
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice("data: ".length))
        .join("");

      if (!payload) continue;
      try {
        events.push(JSON.parse(payload) as ChatStreamEvent);
      } catch {
        // A truncated frame is dropped rather than killing the stream.
      }
    }

    return events;
  };
}
