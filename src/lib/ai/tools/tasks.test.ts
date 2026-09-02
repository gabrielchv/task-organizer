import { describe, expect, it } from "vitest";
import { TaskSession } from "@/features/tasks/session";
import type { Task } from "@/features/tasks/types";
import {
  addTaskTool,
  deleteTaskTool,
  listTasksTool,
  setTaskStatusTool,
  updateTaskTool,
} from "./tasks";
import type { ToolContext } from "./types";

const NOW = new Date("2026-03-10T12:00:00.000Z");

function task(id: string, title: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title,
    status: "pending",
    category: "general",
    date: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function context(initial: Task[] = []): ToolContext {
  let counter = 0;
  return {
    session: new TaskSession(initial, { now: NOW, newId: () => `id-${++counter}` }),
    locale: "en-US",
    timeZone: "UTC",
    signal: undefined,
  };
}

describe("add_task", () => {
  it("creates a task and reports it back without internal timestamps", () => {
    const ctx = context();

    const result = addTaskTool.execute(
      { title: "Dentist", category: "health", date: "2026-03-12T14:00" },
      ctx,
    );

    expect(result).toEqual({
      ok: true,
      task: {
        id: "id-1",
        title: "Dentist",
        status: "pending",
        category: "health",
        date: "2026-03-12T14:00",
      },
    });
  });

  it("defaults an uncategorised task to general with no date", () => {
    const ctx = context();

    const result = addTaskTool.execute({ title: "Something" }, ctx);

    expect(result).toMatchObject({ ok: true, task: { category: "general", date: null } });
  });
});

describe("update_task", () => {
  it("changes only what it was given", () => {
    const ctx = context([task("a", "Gym", { category: "health" })]);

    const result = updateTaskTool.execute({ id: "a", title: "Gym session" }, ctx);

    expect(result).toMatchObject({
      ok: true,
      task: { title: "Gym session", category: "health" },
    });
  });

  it("reports a failure the model can act on when the id is unknown", () => {
    const ctx = context();

    expect(updateTaskTool.execute({ id: "ghost", title: "x" }, ctx)).toEqual({
      ok: false,
      error: "not_found",
      detail: "no task with id ghost",
    });
  });
});

describe("set_task_status", () => {
  it("completes a task", () => {
    const ctx = context([task("a", "Gym")]);

    expect(
      setTaskStatusTool.execute({ id: "a", status: "completed" }, ctx),
    ).toMatchObject({
      ok: true,
      task: { status: "completed" },
    });
  });
});

describe("delete_task", () => {
  it("removes only the named task", () => {
    const ctx = context([task("a", "Gym"), task("b", "Milk")]);

    const result = deleteTaskTool.execute({ id: "a" }, ctx);

    expect(result).toEqual({ ok: true, deletedId: "a" });
    expect(ctx.session.tasks.map((item) => item.id)).toEqual(["b"]);
  });

  it("refuses an unknown id rather than deleting something else", () => {
    const ctx = context([task("a", "Gym")]);

    expect(deleteTaskTool.execute({ id: "ghost" }, ctx)).toMatchObject({ ok: false });
    expect(ctx.session.tasks).toHaveLength(1);
  });
});

describe("list_tasks", () => {
  it("returns everything when no filter is given", () => {
    const ctx = context([task("a", "Gym"), task("b", "Milk", { status: "completed" })]);

    expect(listTasksTool.execute({}, ctx)).toMatchObject({ ok: true, count: 2 });
  });

  it("filters by status", () => {
    const ctx = context([task("a", "Gym"), task("b", "Milk", { status: "completed" })]);

    const result = listTasksTool.execute({ status: "completed" }, ctx) as unknown as {
      tasks: Array<{ id: string }>;
    };

    expect(result.tasks.map((item) => item.id)).toEqual(["b"]);
  });
});

describe("schemas", () => {
  it("rejects a malformed date before it can reach the reducer", () => {
    expect(addTaskTool.schema.safeParse({ title: "x", date: "12/03/2026" }).success).toBe(
      false,
    );
  });

  it("rejects a category outside the known set", () => {
    expect(addTaskTool.schema.safeParse({ title: "x", category: "Saúde" }).success).toBe(
      false,
    );
  });

  it("accepts an all-day date", () => {
    expect(addTaskTool.schema.safeParse({ title: "x", date: "2026-03-12" }).success).toBe(
      true,
    );
  });
});
