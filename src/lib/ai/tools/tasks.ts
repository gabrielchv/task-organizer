import { z } from "zod";
import {
  dueSchema,
  statusSchema,
  titleSchema,
} from "@/features/tasks/operations";
import { TASK_CATEGORIES } from "@/features/tasks/types";
import type { Task } from "@/features/tasks/types";
import { defineTool, type ToolDefinition, type ToolResult } from "./types";

const categorySchema = z
  .enum(TASK_CATEGORIES)
  .describe("Category slug. Pick the closest one; use 'general' when unsure.");

const dateField = dueSchema
  .nullish()
  .describe(
    "Due date as YYYY-MM-DD, or YYYY-MM-DDTHH:mm when a time was given. " +
      "Interpret relative words like 'tomorrow' against the current date in the " +
      "system instruction. Omit when the user gave no date.",
  );

const idField = z.string().min(1).describe("The task's id, taken from the current task list.");

/** What the model sees. Timestamps are dropped: it never needs to reason about them. */
function summarize(task: Task) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    category: task.category,
    date: task.date,
  };
}

function failure(reason: string | undefined, detail: string | undefined): ToolResult {
  return { ok: false, error: reason ?? "rejected", detail: detail ?? null };
}

export const addTaskTool = defineTool({
  name: "add_task",
  description:
    "Create one new task. Call it once per task; to add three things, call it three times.",
  schema: z.object({
    title: titleSchema.describe("Short imperative title, in the user's language."),
    category: categorySchema.optional(),
    date: dateField,
  }),
  execute(input, { session }) {
    const outcome = session.apply({
      type: "add",
      title: input.title,
      ...(input.category === undefined ? {} : { category: input.category }),
      ...(input.date === undefined ? {} : { date: input.date }),
    });
    if (!outcome.ok || !outcome.task) return failure(outcome.reason, outcome.detail);
    return { ok: true, task: summarize(outcome.task) };
  },
});

export const updateTaskTool = defineTool({
  name: "update_task",
  description:
    "Change an existing task's title, category or due date. Only pass the fields that change; " +
    "pass date: null to clear a due date.",
  schema: z.object({
    id: idField,
    title: titleSchema.optional(),
    category: categorySchema.optional(),
    date: dateField,
  }),
  execute(input, { session }) {
    const outcome = session.apply({
      type: "update",
      id: input.id,
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.category === undefined ? {} : { category: input.category }),
      ...(input.date === undefined ? {} : { date: input.date }),
    });
    if (!outcome.ok || !outcome.task) return failure(outcome.reason, outcome.detail);
    return { ok: true, task: summarize(outcome.task) };
  },
});

export const setTaskStatusTool = defineTool({
  name: "set_task_status",
  description: "Mark a task completed, or move a completed task back to pending.",
  schema: z.object({ id: idField, status: statusSchema }),
  execute(input, { session }) {
    const outcome = session.apply({
      type: "set_status",
      id: input.id,
      status: input.status,
    });
    if (!outcome.ok || !outcome.task) return failure(outcome.reason, outcome.detail);
    return { ok: true, task: summarize(outcome.task) };
  },
});

export const deleteTaskTool = defineTool({
  name: "delete_task",
  description:
    "Permanently remove one task. Only call this when the user asked for that specific task to " +
    "be removed. Completing a task is set_task_status, not deletion.",
  schema: z.object({ id: idField }),
  execute(input, { session }) {
    const outcome = session.apply({ type: "delete", id: input.id });
    if (!outcome.ok) return failure(outcome.reason, outcome.detail);
    return { ok: true, deletedId: input.id };
  },
});

export const listTasksTool = defineTool({
  name: "list_tasks",
  description:
    "Read the current task list. Use it to find an id before updating or deleting, or to answer " +
    "questions about what is on the list.",
  schema: z.object({
    status: statusSchema.optional().describe("Filter by status. Omit to get everything."),
  }),
  execute(input, { session }) {
    const tasks = session.tasks.filter(
      (task) => input.status === undefined || task.status === input.status,
    );
    return { ok: true, count: tasks.length, tasks: tasks.map(summarize) };
  },
});

export const taskTools: ToolDefinition[] = [
  addTaskTool,
  updateTaskTool,
  setTaskStatusTool,
  deleteTaskTool,
  listTasksTool,
] as ToolDefinition[];
