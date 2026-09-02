import { taskListSchema } from "./schema";
import type { Task } from "./types";

export const GUEST_STORAGE_KEY = "guest_tasks";

/**
 * Reads a guest's tasks out of localStorage.
 *
 * Everything is validated on the way in: the value is user-editable, may have
 * been written by an older version of the app, and feeds straight into the
 * request sent to the API.
 */
export function readGuestTasks(storage: Storage): Task[] {
  let raw: string | null;
  try {
    raw = storage.getItem(GUEST_STORAGE_KEY);
  } catch {
    // Safari in private mode throws on access rather than returning null.
    return [];
  }
  if (!raw) return [];

  try {
    const parsed = taskListSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function writeGuestTasks(storage: Storage, tasks: readonly Task[]): void {
  try {
    storage.setItem(GUEST_STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Quota exceeded or storage disabled: the in-memory list still works for
    // this session, so there is nothing useful to tell the user.
  }
}

export function clearGuestTasks(storage: Storage): void {
  try {
    storage.removeItem(GUEST_STORAGE_KEY);
  } catch {
    // See above.
  }
}
