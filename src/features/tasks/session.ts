import { applyOperations, type ApplyContext, type RejectionReason } from "./reducer";
import type { TaskOperation } from "./operations";
import type { Task } from "./types";

export interface OperationOutcome {
  ok: boolean;
  task?: Task;
  reason?: RejectionReason;
  detail?: string;
}

/**
 * A single conversational turn's worth of task edits.
 *
 * The assistant may call several tools in one turn, and a later call often
 * depends on an earlier one ("add dentist, then mark it done"). The session
 * applies each operation immediately so the next tool sees the new state, while
 * recording the ones that succeeded so the caller can persist exactly those.
 */
export class TaskSession {
  #tasks: Task[];
  readonly #context: ApplyContext;
  readonly #operations: TaskOperation[] = [];

  constructor(initial: readonly Task[], context: ApplyContext) {
    this.#tasks = initial.map((task) => ({ ...task }));
    this.#context = context;
  }

  get tasks(): readonly Task[] {
    return this.#tasks;
  }

  /** The operations that were accepted, in order, ready to be persisted. */
  get operations(): readonly TaskOperation[] {
    return this.#operations;
  }

  get changed(): boolean {
    return this.#operations.length > 0;
  }

  apply(operation: TaskOperation): OperationOutcome {
    const before = new Set(this.#tasks.map((task) => task.id));
    const result = applyOperations(this.#tasks, [operation], this.#context);

    const rejection = result.rejected[0];
    if (rejection) {
      return rejection.detail === undefined
        ? { ok: false, reason: rejection.reason }
        : { ok: false, reason: rejection.reason, detail: rejection.detail };
    }

    this.#tasks = result.tasks;
    this.#operations.push(operation);

    if (operation.type === "delete") return { ok: true };

    const task =
      operation.type === "add"
        ? this.#tasks.find((candidate) => !before.has(candidate.id))
        : this.#tasks.find((candidate) => candidate.id === operation.id);

    return task === undefined ? { ok: true } : { ok: true, task };
  }
}
