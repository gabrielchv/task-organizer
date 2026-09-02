/**
 * A task category. Stored as a stable slug rather than a display string so that
 * grouping survives a language switch — the previous version let the model emit
 * localized free text ("Saúde" vs "Health"), which fragmented the list.
 */
export const TASK_CATEGORIES = [
  "appointment",
  "work",
  "personal",
  "health",
  "finance",
  "errands",
  "study",
  "general",
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export type TaskStatus = "pending" | "completed";

/**
 * A task's due date, in the user's own timezone. Two shapes are allowed:
 *
 * - `YYYY-MM-DD`       — an all-day task ("dentist on Friday")
 * - `YYYY-MM-DDTHH:mm` — a task with a time ("dentist Friday at 2pm")
 *
 * Deliberately not a UTC instant: "tomorrow" is a wall-clock concept, and
 * storing it as an instant makes the day flip for anyone travelling.
 */
export type TaskDue = string;

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  category: TaskCategory;
  date: TaskDue | null;
  /** ISO 8601 instant. */
  createdAt: string;
  /** ISO 8601 instant. */
  updatedAt: string;
}

/** The subset a user or the assistant may set directly. */
export type TaskDraft = Pick<Task, "title"> &
  Partial<Pick<Task, "status" | "category" | "date">>;
