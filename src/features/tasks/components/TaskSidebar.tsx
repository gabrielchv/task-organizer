"use client";

import { ChatIcon, ClipboardIcon } from "@/components/icons";
import type { Dictionary } from "@/i18n";
import { TaskActions, type TaskActionsProps } from "./TaskActions";
import { TaskList } from "./TaskList";
import type { Task } from "../types";

interface TaskSidebarProps extends Omit<TaskActionsProps, "dictionary" | "isSignedIn"> {
  isOpen: boolean;
  onClose: () => void;
  tasks: readonly Task[];
  isLoaded: boolean;
  locale: string;
  dictionary: Dictionary;
  isSignedIn: boolean;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

export function TaskSidebar({
  isOpen,
  onClose,
  tasks,
  isLoaded,
  locale,
  dictionary,
  isSignedIn,
  onToggleTask,
  onDeleteTask,
  ...actions
}: TaskSidebarProps) {
  return (
    <aside
      aria-label={dictionary.tasksMenu}
      className={`absolute inset-0 z-40 flex w-full shrink-0 flex-col bg-gray-50 transition-transform duration-300 md:relative md:inset-auto md:z-10 md:w-80 lg:w-96 ${
        isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
      }`}
    >
      <header className="flex h-15 shrink-0 items-center justify-between border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 p-4 shadow-sm md:h-18">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 shadow-sm">
            <ClipboardIcon className="h-4 w-4 text-white" />
          </span>
          <h2 className="text-lg font-bold text-gray-800">
            {isSignedIn ? dictionary.listTitleCloud : dictionary.listTitleLocal}
          </h2>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto p-4 pb-20">
        <TaskActions dictionary={dictionary} isSignedIn={isSignedIn} {...actions} />
        <TaskList
          tasks={tasks}
          isLoaded={isLoaded}
          locale={locale}
          dictionary={dictionary}
          onToggle={onToggleTask}
          onDelete={onDeleteTask}
        />
      </div>

      {isOpen && (
        <div className="pointer-events-none fixed bottom-3 left-3 right-3 z-50 md:hidden">
          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 p-4 font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-xl active:scale-95"
          >
            <ChatIcon />
            <span>{dictionary.backToChat}</span>
          </button>
        </div>
      )}
    </aside>
  );
}
