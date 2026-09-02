import { z } from "zod";

/**
 * The complete vocabulary of changes anyone — user or assistant — can make to a
 * task list. Nothing else may touch the list: `applyOperations` is the only
 * writer, and it only understands these.
 *
 * This is the fix for the previous design, where the model returned a whole
 * rewritten array and any task missing from it was deleted from Firestore.
 */

export const MAX_TITLE_LENGTH = 200;

/**
 * `YYYY-MM-DD` for an all-day task, `YYYY-MM-DDTHH:mm` when a time was given.
 * Local wall-clock, never a UTC instant — see `TaskDue`.
 */
export const DUE_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;

export const dueSchema = z
  .string()
  .regex(DUE_PATTERN, "date must be YYYY-MM-DD or YYYY-MM-DDTHH:mm");

export const titleSchema = z.string().trim().min(1).max(MAX_TITLE_LENGTH);

export const statusSchema = z.enum(["pending", "completed"]);

export const addTaskSchema = z.object({
  type: z.literal("add"),
  title: titleSchema,
  /** Free text is accepted and mapped onto a slug by `normalizeCategory`. */
  category: z.string().max(64).optional(),
  date: dueSchema.nullish(),
  status: statusSchema.optional(),
});

export const updateTaskSchema = z.object({
  type: z.literal("update"),
  id: z.string().min(1),
  title: titleSchema.optional(),
  category: z.string().max(64).optional(),
  /** `null` clears the date; omitting the field leaves it untouched. */
  date: dueSchema.nullish(),
});

export const setStatusSchema = z.object({
  type: z.literal("set_status"),
  id: z.string().min(1),
  status: statusSchema,
});

export const deleteTaskSchema = z.object({
  type: z.literal("delete"),
  id: z.string().min(1),
});

export const taskOperationSchema = z.discriminatedUnion("type", [
  addTaskSchema,
  updateTaskSchema,
  setStatusSchema,
  deleteTaskSchema,
]);

export type AddTaskOperation = z.infer<typeof addTaskSchema>;
export type UpdateTaskOperation = z.infer<typeof updateTaskSchema>;
export type SetStatusOperation = z.infer<typeof setStatusSchema>;
export type DeleteTaskOperation = z.infer<typeof deleteTaskSchema>;
export type TaskOperation = z.infer<typeof taskOperationSchema>;
