import { describe, expect, it, vi } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import type { AppliedOperation } from "@/features/tasks/session";
import type { Task } from "@/features/tasks/types";
import { persistOperations } from "./tasks-repository";

interface RecordedWrite {
  kind: "set" | "delete";
  path: string;
  data?: Record<string, unknown>;
}

/** Records the batch a call would commit, without touching Firestore. */
function fakeDb() {
  const writes: RecordedWrite[] = [];
  const commit = vi.fn(async () => undefined);

  const docRef = (path: string) => ({ path });
  const db = {
    collection: (name: string) => ({
      doc: (uid: string) => ({
        collection: (sub: string) => ({
          doc: (id: string) => docRef(`${name}/${uid}/${sub}/${id}`),
        }),
      }),
    }),
    batch: () => ({
      set: (ref: { path: string }, data: Record<string, unknown>) => {
        writes.push({ kind: "set", path: ref.path, data });
      },
      delete: (ref: { path: string }) => {
        writes.push({ kind: "delete", path: ref.path });
      },
      commit,
    }),
  };

  return { db: db as unknown as Firestore, writes, commit };
}

function task(id: string, title: string): Task {
  return {
    id,
    title,
    status: "pending",
    category: "general",
    date: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  };
}

const applied = (
  operation: AppliedOperation["operation"],
  taskId: string,
): AppliedOperation => ({ operation, taskId });

describe("persistOperations", () => {
  it("does nothing when the turn changed nothing", async () => {
    const { db, commit } = fakeDb();

    await persistOperations(db, "alice", [task("a", "Gym")], []);

    expect(commit).not.toHaveBeenCalled();
  });

  it("writes only the document an operation named, with its new content", async () => {
    const { db, writes } = fakeDb();
    // The list handed in is the post-reducer state, so "b" already carries the
    // new title; the other two are untouched and must not be written at all.
    const tasks = [task("a", "Gym"), task("b", "Oat milk"), task("c", "Rent")];

    await persistOperations(db, "alice", tasks, [
      applied({ type: "update", id: "b", title: "Oat milk" }, "b"),
    ]);

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ kind: "set", path: "users/alice/tasks/b" });
    expect(writes[0]?.data).toMatchObject({ title: "Oat milk" });
  });

  it("never issues a delete that no operation asked for", async () => {
    const { db, writes } = fakeDb();
    const tasks = [task("a", "Gym"), task("b", "Milk")];

    await persistOperations(db, "alice", tasks, [
      applied({ type: "add", title: "New" }, "a"),
    ]);

    expect(writes.some((write) => write.kind === "delete")).toBe(false);
  });

  it("deletes exactly the document named", async () => {
    const { db, writes } = fakeDb();

    await persistOperations(
      db,
      "alice",
      [task("a", "Gym")],
      [applied({ type: "delete", id: "b" }, "b")],
    );

    expect(writes).toEqual([{ kind: "delete", path: "users/alice/tasks/b" }]);
  });

  it("collapses repeated edits to one document into a single write", async () => {
    const { db, writes } = fakeDb();
    const tasks = [task("a", "Gym")];

    await persistOperations(db, "alice", tasks, [
      applied({ type: "update", id: "a", title: "Gym session" }, "a"),
      applied({ type: "set_status", id: "a", status: "completed" }, "a"),
    ]);

    expect(writes).toHaveLength(1);
    expect(writes[0]?.kind).toBe("set");
  });

  it("ends on a delete when a task was added and then removed in one turn", async () => {
    const { db, writes } = fakeDb();

    await persistOperations(
      db,
      "alice",
      [],
      [
        applied({ type: "add", title: "Oops" }, "tmp"),
        applied({ type: "delete", id: "tmp" }, "tmp"),
      ],
    );

    expect(writes).toEqual([{ kind: "delete", path: "users/alice/tasks/tmp" }]);
  });

  it("scopes every write under the uid it was given", async () => {
    const { db, writes } = fakeDb();

    await persistOperations(
      db,
      "bob",
      [task("a", "Gym")],
      [applied({ type: "set_status", id: "a", status: "completed" }, "a")],
    );

    expect(writes.every((write) => write.path.startsWith("users/bob/"))).toBe(true);
  });
});
