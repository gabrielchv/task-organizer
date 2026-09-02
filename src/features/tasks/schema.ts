import { z } from "zod";
import { dueSchema, statusSchema, titleSchema } from "./operations";
import { TASK_CATEGORIES } from "./types";

/**
 * Wire representation of a task. Used to validate the list a guest sends up
 * with their request, which is untrusted input from the browser.
 */
export const taskSchema = z.object({
  id: z.string().min(1).max(128),
  title: titleSchema,
  status: statusSchema,
  category: z.enum(TASK_CATEGORIES),
  date: dueSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const taskListSchema = z.array(taskSchema).max(200);
