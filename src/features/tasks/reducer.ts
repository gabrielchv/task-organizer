import { normalizeCategory } from "./categories";
import { taskOperationSchema, type TaskOperation } from "./operations";
import type { Task } from "./types";

/** Guards against a runaway loop filling someone's list. */
export const MAX_TASKS_PER_USER = 200;

export type RejectionReason = "not_found" | "invalid" | "limit_reached";

export interface RejectedOperation {
  operation: TaskOperation;
  reason: RejectionReason;
  detail?: string;
}

export interface ApplyContext {
  now: Date;
  newId: () => string;
}

export interface ApplyResult {
  tasks: Task[];
  applied: TaskOperation[];
  rejected: RejectedOperation[];
}

/**
 * Applies operations to a task list and returns a new list.
 *
 * Pure: no I/O, no clock, no randomness — `now` and `newId` come from the
 * caller. That is what lets the same function run on the server against
 * Firestore and in the browser against localStorage, with identical results.
 *
 * A task disappears if and only if a `delete` operation named its id. An
 * operation naming an unknown id is rejected with a reason, never ignored and
 * never turned into a create.
 */
export function applyOperations(
  tasks: readonly Task[],
  operations: readonly TaskOperation[],
  { now, newId }: ApplyContext,
): ApplyResult {
  const timestamp = now.toISOString();
  const next = tasks.map((task) => ({ ...task }));
  const indexById = new Map(next.map((task, index) => [task.id, index]));

  const applied: TaskOperation[] = [];
  const rejected: RejectedOperation[] = [];

  const reject = (operation: TaskOperation, reason: RejectionReason, detail?: string) => {
    rejected.push(detail === undefined ? { operation, reason } : { operation, reason, detail });
  };

  for (const raw of operations) {
    // The assistant is an untrusted producer, so every operation is re-validated
    // here even though the transport layer already parsed the payload.
    const parsed = taskOperationSchema.safeParse(raw);
    if (!parsed.success) {
      reject(raw, "invalid", parsed.error.issues[0]?.message ?? "invalid operation");
      continue;
    }
    const operation = parsed.data;

    if (operation.type === "add") {
      if (next.length >= MAX_TASKS_PER_USER) {
        reject(operation, "limit_reached", `at most ${MAX_TASKS_PER_USER} tasks`);
        continue;
      }
      const task: Task = {
        id: newId(),
        title: operation.title,
        status: operation.status ?? "pending",
        category: normalizeCategory(operation.category),
        date: operation.date ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      indexById.set(task.id, next.length);
      next.push(task);
      applied.push(operation);
      continue;
    }

    const index = indexById.get(operation.id);
    const existing = index === undefined ? undefined : next[index];
    if (index === undefined || existing === undefined) {
      reject(operation, "not_found", `no task with id ${operation.id}`);
      continue;
    }

    switch (operation.type) {
      case "update": {
        next[index] = {
          ...existing,
          ...(operation.title !== undefined ? { title: operation.title } : {}),
          ...(operation.category !== undefined
            ? { category: normalizeCategory(operation.category) }
            : {}),
          ...(operation.date !== undefined ? { date: operation.date ?? null } : {}),
          updatedAt: timestamp,
        };
        applied.push(operation);
        break;
      }
      case "set_status": {
        next[index] = { ...existing, status: operation.status, updatedAt: timestamp };
        applied.push(operation);
        break;
      }
      case "delete": {
        next.splice(index, 1);
        indexById.clear();
        next.forEach((task, i) => indexById.set(task.id, i));
        applied.push(operation);
        break;
      }
    }
  }

  return { tasks: next, applied, rejected };
}
