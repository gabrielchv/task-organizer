import { applyOperations, type ApplyContext, type RejectionReason } from "./reducer";
import type { TaskOperation } from "./operations";
import type { Task } from "./types";

/** An operation that was accepted, paired with the document it affected. */
export interface AppliedOperation {
  operation: TaskOperation;
  taskId: string;
}

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
  readonly #operations: AppliedOperation[] = [];

  constructor(initial: readonly Task[], context: ApplyContext) {
    this.#tasks = initial.map((task) => ({ ...task }));
    this.#context = context;
  }

  get tasks(): readonly Task[] {
    return this.#tasks;
  }

  /**
   * The operations that were accepted, in order, each paired with the id of the
   * document it affected. Carrying the id here is what lets the persistence
   * layer write exactly the touched documents without inferring anything.
   */
  get operations(): readonly AppliedOperation[] {
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

    if (operation.type === "delete") {
      this.#operations.push({ operation, taskId: operation.id });
      return { ok: true };
    }

    const task =
      operation.type === "add"
        ? this.#tasks.find((candidate) => !before.has(candidate.id))
        : this.#tasks.find((candidate) => candidate.id === operation.id);

    if (task === undefined) return { ok: true };

    this.#operations.push({ operation, taskId: task.id });
    return { ok: true, task };
  }
}
