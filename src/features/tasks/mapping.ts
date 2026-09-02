import { normalizeCategory } from "./categories";
import { DUE_PATTERN } from "./operations";
import type { Task } from "./types";

const EPOCH = new Date(0).toISOString();

/**
 * Builds a `Task` from a stored document.
 *
 * Documents written before this rewrite carry no timestamps and hold localized
 * free-text categories, and a document can also be edited by hand in the
 * console, so every field is coerced rather than trusted. Shared by the server
 * repository and the browser's realtime listener so the two cannot disagree.
 */
export function toTask(id: string, data: Record<string, unknown>): Task {
  const rawDate = data["date"];
  const date = typeof rawDate === "string" && DUE_PATTERN.test(rawDate) ? rawDate : null;

  const createdAt = typeof data["createdAt"] === "string" ? data["createdAt"] : undefined;
  const updatedAt = typeof data["updatedAt"] === "string" ? data["updatedAt"] : undefined;

  return {
    id,
    title: typeof data["title"] === "string" ? data["title"] : "",
    status: data["status"] === "completed" ? "completed" : "pending",
    category: normalizeCategory(data["category"]),
    date,
    createdAt: createdAt ?? EPOCH,
    updatedAt: updatedAt ?? createdAt ?? EPOCH,
  };
}

/** Firestore fields for a task; the id lives in the document path. */
export function toDocument(task: Task): Record<string, unknown> {
  const { id: _id, ...fields } = task;
  return fields;
}
