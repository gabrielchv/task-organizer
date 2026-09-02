import type { Firestore } from "firebase-admin/firestore";
import { normalizeCategory } from "@/features/tasks/categories";
import type { AppliedOperation } from "@/features/tasks/session";
import type { Task } from "@/features/tasks/types";

const TASKS_LIMIT = 500;

function tasksCollection(db: Firestore, uid: string) {
  return db.collection("users").doc(uid).collection("tasks");
}

/**
 * Reads a stored document into a `Task`.
 *
 * Documents written before this rewrite have no timestamps and hold localized
 * free-text categories, so every field is coerced here rather than trusted.
 */
function toTask(id: string, data: FirebaseFirestore.DocumentData): Task {
  const date = typeof data["date"] === "string" ? data["date"] : null;
  const createdAt = typeof data["createdAt"] === "string" ? data["createdAt"] : undefined;
  const updatedAt = typeof data["updatedAt"] === "string" ? data["updatedAt"] : undefined;
  const fallback = new Date(0).toISOString();

  return {
    id,
    title: typeof data["title"] === "string" ? data["title"] : "",
    status: data["status"] === "completed" ? "completed" : "pending",
    category: normalizeCategory(data["category"]),
    date,
    createdAt: createdAt ?? fallback,
    updatedAt: updatedAt ?? createdAt ?? fallback,
  };
}

export async function readTasks(db: Firestore, uid: string): Promise<Task[]> {
  const snapshot = await tasksCollection(db, uid).limit(TASKS_LIMIT).get();
  return snapshot.docs.map((doc) => toTask(doc.id, doc.data()));
}

/**
 * Writes the effect of a turn's operations.
 *
 * Only the documents named by an operation are touched. The previous
 * implementation batched a `set` for every task the model returned plus a
 * `delete` for every id missing from that list, so a truncated model response
 * silently destroyed the rest of the user's data.
 */
export async function persistOperations(
  db: Firestore,
  uid: string,
  tasks: readonly Task[],
  operations: readonly AppliedOperation[],
): Promise<void> {
  if (operations.length === 0) return;

  const collection = tasksCollection(db, uid);
  const byId = new Map(tasks.map((task) => [task.id, task]));

  // Collapse repeated edits to the same document into a single write, keeping
  // the last outcome: adding then deleting a task within one turn is a no-op.
  const writes = new Map<string, "set" | "delete">();
  for (const { operation, taskId } of operations) {
    writes.set(taskId, operation.type === "delete" ? "delete" : "set");
  }

  const batch = db.batch();
  for (const [id, kind] of writes) {
    const ref = collection.doc(id);
    if (kind === "delete") {
      batch.delete(ref);
      continue;
    }
    const task = byId.get(id);
    if (!task) continue;
    const { id: _id, ...fields } = task;
    batch.set(ref, fields, { merge: true });
  }

  await batch.commit();
}
