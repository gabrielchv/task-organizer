import { describe, expect, it } from "vitest";
import { TaskSession } from "./session";
import type { Task } from "./types";

const NOW = new Date("2026-03-10T12:00:00.000Z");

function task(id: string, title: string): Task {
  return {
    id,
    title,
    status: "pending",
    category: "general",
    date: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

function session(initial: Task[] = []) {
  let counter = 0;
  return new TaskSession(initial, { now: NOW, newId: () => `id-${++counter}` });
}

describe("TaskSession", () => {
  it("returns the created task so the assistant can refer to it", () => {
    const s = session();

    const outcome = s.apply({ type: "add", title: "Dentist" });

    expect(outcome.ok).toBe(true);
    expect(outcome.task).toMatchObject({ id: "id-1", title: "Dentist" });
  });

  it("makes an earlier addition visible to a later operation in the same turn", () => {
    const s = session();

    s.apply({ type: "add", title: "Dentist" });
    const outcome = s.apply({ type: "set_status", id: "id-1", status: "completed" });

    expect(outcome.ok).toBe(true);
    expect(s.tasks[0]?.status).toBe("completed");
  });

  it("records only the operations that were accepted", () => {
    const s = session([task("a", "Gym")]);

    s.apply({ type: "add", title: "Dentist" });
    s.apply({ type: "delete", id: "ghost" });
    s.apply({ type: "delete", id: "a" });

    expect(s.operations.map((applied) => applied.operation.type)).toEqual(["add", "delete"]);
    expect(s.operations.map((applied) => applied.taskId)).toEqual(["id-1", "a"]);
  });

  it("reports why an operation failed instead of throwing", () => {
    const s = session();

    const outcome = s.apply({ type: "update", id: "ghost", title: "Nope" });

    expect(outcome).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("leaves state untouched when an operation is rejected", () => {
    const s = session([task("a", "Gym")]);

    s.apply({ type: "delete", id: "ghost" });

    expect(s.tasks).toHaveLength(1);
    expect(s.changed).toBe(false);
  });

  it("does not mutate the array it was constructed with", () => {
    const initial = [task("a", "Gym")];
    const s = session(initial);

    s.apply({ type: "delete", id: "a" });

    expect(initial).toHaveLength(1);
  });
});
