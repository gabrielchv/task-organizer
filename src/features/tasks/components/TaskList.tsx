"use client";

import { CalendarIcon, CheckIcon, ClipboardIcon, TrashIcon } from "@/components/icons";
import type { Dictionary } from "@/i18n";
import { formatDue } from "../dates";
import type { Task, TaskCategory } from "../types";

interface TaskListProps {
  tasks: readonly Task[];
  isLoaded: boolean;
  locale: string;
  dictionary: Dictionary;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3 p-4" aria-hidden>
      <div className="mb-4 h-4 w-1/3 rounded bg-gray-200" />
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex flex-col gap-2">
          <div className="h-3 w-1/4 rounded bg-gray-200" />
          <div className="h-10 w-full rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ dictionary }: { dictionary: Dictionary }) {
  return (
    <div className="mt-16 text-center">
      <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <ClipboardIcon className="h-8 w-8 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-400">{dictionary.noTasks}</p>
      <p className="mt-1 text-xs text-gray-300">{dictionary.noTasksDescription}</p>
    </div>
  );
}

export function TaskList({
  tasks,
  isLoaded,
  locale,
  dictionary,
  onToggle,
  onDelete,
}: TaskListProps) {
  if (!isLoaded) return <Skeleton />;
  if (tasks.length === 0) return <EmptyState dictionary={dictionary} />;

  const grouped = new Map<TaskCategory, Task[]>();
  for (const task of tasks) {
    const bucket = grouped.get(task.category);
    if (bucket) bucket.push(task);
    else grouped.set(task.category, [task]);
  }

  return (
    <div className="space-y-6">
      {[...grouped].map(([category, items]) => (
        <section key={category} className="space-y-3">
          <h3 className="flex items-center gap-2 pl-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            <span className="h-1 w-1 rounded-full bg-blue-500" />
            {dictionary.categories[category]}
          </h3>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {items.map((task) => (
              <li
                key={task.id}
                className="group flex items-start gap-3 p-3.5 pl-4 transition-all hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent"
              >
                <button
                  type="button"
                  onClick={() => onToggle(task.id)}
                  role="checkbox"
                  aria-checked={task.status === "completed"}
                  aria-label={`${dictionary.toggleTask}: ${task.title}`}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                    task.status === "completed"
                      ? "border-green-500 bg-gradient-to-br from-green-500 to-green-600 shadow-sm shadow-green-500/20"
                      : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                  }`}
                >
                  {task.status === "completed" && (
                    <CheckIcon className="h-3.5 w-3.5 text-white" />
                  )}
                </button>

                <div className="my-auto flex min-w-0 flex-1 flex-col">
                  <span
                    className={`break-words text-sm font-medium leading-snug ${
                      task.status === "completed"
                        ? "text-gray-400 line-through decoration-gray-300"
                        : "text-gray-800"
                    }`}
                  >
                    {task.title}
                  </span>
                  {task.date && (
                    <span className="mt-1.5 flex w-fit items-center gap-1.5 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                      <CalendarIcon className="h-3 w-3" />
                      {formatDue(task.date, locale)}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onDelete(task.id)}
                  aria-label={`${dictionary.deleteTask}: ${task.title}`}
                  className="-mt-1.5 rounded-md p-2 text-gray-300 transition-all hover:bg-red-50 hover:text-red-500 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
