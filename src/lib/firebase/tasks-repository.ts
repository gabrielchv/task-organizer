import type { Firestore } from "firebase-admin/firestore";
import { toDocument, toTask } from "@/features/tasks/mapping";
import type { AppliedOperation } from "@/features/tasks/session";
import type { Task } from "@/features/tasks/types";

const TASKS_LIMIT = 500;

function tasksCollection(db: Firestore, uid: string) {
  return db.collection("users").doc(uid).collection("tasks");
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
    batch.set(ref, toDocument(task), { merge: true });
  }

  await batch.commit();
}
