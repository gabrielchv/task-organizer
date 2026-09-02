import { describe, expect, it } from "vitest";
import { applyOperations, MAX_TASKS_PER_USER } from "./reducer";
import type { Task } from "./types";
import type { TaskOperation } from "./operations";

const NOW = new Date("2026-03-10T12:00:00.000Z");

function task(overrides: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    status: "pending",
    category: "general",
    date: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function apply(tasks: Task[], operations: TaskOperation[]) {
  let counter = 0;
  return applyOperations(tasks, operations, {
    now: NOW,
    newId: () => `generated-${++counter}`,
  });
}

describe("applyOperations", () => {
  describe("the invariant that motivated this rewrite", () => {
    it("keeps every task that was not explicitly deleted", () => {
      const existing = [
        task({ id: "a", title: "Buy milk" }),
        task({ id: "b", title: "Dentist" }),
        task({ id: "c", title: "Call mum" }),
        task({ id: "d", title: "Pay rent" }),
        task({ id: "e", title: "Gym" }),
      ];

      const result = apply(existing, [{ type: "delete", id: "b" }]);

      expect(result.tasks.map((t) => t.id)).toEqual(["a", "c", "d", "e"]);
    });

    it("cannot drop tasks it was never told about", () => {
      const existing = [task({ id: "a", title: "Buy milk" })];

      // An "add" is the only operation here; the untouched task must survive.
      const result = apply(existing, [{ type: "add", title: "New thing" }]);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0]?.id).toBe("a");
    });
  });

  describe("add", () => {
    it("assigns an id, timestamps and defaults", () => {
      const result = apply([], [{ type: "add", title: "  Buy milk  " }]);

      expect(result.tasks).toEqual([
        {
          id: "generated-1",
          title: "Buy milk",
          status: "pending",
          category: "general",
          date: null,
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        },
      ]);
      expect(result.applied).toHaveLength(1);
      expect(result.rejected).toHaveLength(0);
    });

    it("normalizes a legacy localized category onto a slug", () => {
      const result = apply([], [{ type: "add", title: "Consulta", category: "Saúde" }]);

      expect(result.tasks[0]?.category).toBe("health");
    });

    it("rejects an empty title", () => {
      const result = apply([], [{ type: "add", title: "   " }]);

      expect(result.tasks).toHaveLength(0);
      expect(result.rejected[0]?.reason).toBe("invalid");
    });

    it("rejects once the per-user cap is reached", () => {
      const full = Array.from({ length: MAX_TASKS_PER_USER }, (_, i) =>
        task({ id: `t${i}`, title: `Task ${i}` }),
      );

      const result = apply(full, [{ type: "add", title: "One too many" }]);

      expect(result.tasks).toHaveLength(MAX_TASKS_PER_USER);
      expect(result.rejected[0]?.reason).toBe("limit_reached");
    });
  });

  describe("update", () => {
    it("changes only the fields provided and bumps updatedAt", () => {
      const existing = [task({ id: "a", title: "Buy milk", category: "errands" })];

      const result = apply(existing, [
        { type: "update", id: "a", title: "Buy oat milk" },
      ]);

      expect(result.tasks[0]).toMatchObject({
        id: "a",
        title: "Buy oat milk",
        category: "errands",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: NOW.toISOString(),
      });
    });

    it("clears a due date when date is explicitly null", () => {
      const existing = [task({ id: "a", title: "Dentist", date: "2026-03-12" })];

      const result = apply(existing, [{ type: "update", id: "a", date: null }]);

      expect(result.tasks[0]?.date).toBeNull();
    });

    it("rejects an unknown id instead of silently creating a task", () => {
      const result = apply([], [{ type: "update", id: "ghost", title: "Nope" }]);

      expect(result.tasks).toHaveLength(0);
      expect(result.rejected[0]).toMatchObject({ reason: "not_found" });
    });
  });

  describe("set_status", () => {
    it("completes a task", () => {
      const existing = [task({ id: "a", title: "Gym" })];

      const result = apply(existing, [
        { type: "set_status", id: "a", status: "completed" },
      ]);

      expect(result.tasks[0]?.status).toBe("completed");
      expect(result.tasks[0]?.updatedAt).toBe(NOW.toISOString());
    });

    it("rejects an unknown id", () => {
      const result = apply(
        [],
        [{ type: "set_status", id: "ghost", status: "completed" }],
      );

      expect(result.rejected[0]?.reason).toBe("not_found");
    });
  });

  describe("delete", () => {
    it("rejects an unknown id", () => {
      const existing = [task({ id: "a", title: "Gym" })];

      const result = apply(existing, [{ type: "delete", id: "ghost" }]);

      expect(result.tasks).toHaveLength(1);
      expect(result.rejected[0]?.reason).toBe("not_found");
    });
  });

  describe("sequencing", () => {
    it("lets a later operation act on a task added earlier in the batch", () => {
      const result = apply(
        [],
        [
          { type: "add", title: "Dentist" },
          { type: "set_status", id: "generated-1", status: "completed" },
        ],
      );

      expect(result.tasks[0]?.status).toBe("completed");
      expect(result.rejected).toHaveLength(0);
    });

    it("keeps going after a rejected operation", () => {
      const result = apply(
        [],
        [
          { type: "delete", id: "ghost" },
          { type: "add", title: "Still added" },
        ],
      );

      expect(result.tasks).toHaveLength(1);
      expect(result.applied).toHaveLength(1);
      expect(result.rejected).toHaveLength(1);
    });

    it("does not mutate the input array", () => {
      const existing = [task({ id: "a", title: "Gym" })];
      const snapshot = structuredClone(existing);

      apply(existing, [{ type: "delete", id: "a" }]);

      expect(existing).toEqual(snapshot);
    });
  });
});
