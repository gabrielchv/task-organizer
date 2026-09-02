"use client";

import {
  CalendarIcon,
  ClipboardIcon,
  CopyIcon,
  MicrophoneIcon,
} from "@/components/icons";
import type { Dictionary } from "@/i18n";

export interface TaskActionsProps {
  dictionary: Dictionary;
  isSignedIn: boolean;
  isWakeWordEnabled: boolean;
  isWakeWordLoading: boolean;
  onToggleWakeWord: () => void;
  onCopy: () => void;
  onExportTasks: () => void;
  onExportCalendar: () => void;
}

export function WakeWordToggle({
  dictionary,
  isWakeWordEnabled,
  isWakeWordLoading,
  onToggleWakeWord,
  className = "",
}: Pick<
  TaskActionsProps,
  "dictionary" | "isWakeWordEnabled" | "isWakeWordLoading" | "onToggleWakeWord"
> & { className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isWakeWordEnabled}
      disabled={isWakeWordLoading}
      onClick={onToggleWakeWord}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all disabled:opacity-60 ${
        isWakeWordEnabled
          ? "border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 font-semibold text-green-700 shadow-sm"
          : "border border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-50"
      } ${className}`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          isWakeWordEnabled ? "bg-green-100" : "bg-gray-100"
        }`}
      >
        <MicrophoneIcon
          className={`h-4 w-4 ${isWakeWordEnabled ? "text-green-600" : "text-gray-500"}`}
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold">{dictionary.wakeWord}</span>
        <span className="truncate text-[10px] font-normal text-gray-500">
          {isWakeWordLoading ? dictionary.wakeWordLoading : dictionary.wakeWordLabel}
        </span>
      </span>
      <span
        className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${
          isWakeWordEnabled ? "bg-green-200 text-green-800" : "bg-gray-200 text-gray-600"
        }`}
      >
        {isWakeWordEnabled ? dictionary.on : dictionary.off}
      </span>
    </button>
  );
}

function ActionButton({
  onClick,
  label,
  icon,
  tone = "text-gray-700",
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left text-sm transition-all hover:border-gray-200 hover:bg-gray-50 active:scale-[0.98] ${tone}`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100">
        {icon}
      </span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

/** The desktop tools panel above the task list. */
export function TaskActions({
  dictionary,
  isSignedIn,
  onCopy,
  onExportTasks,
  onExportCalendar,
  ...wakeWord
}: TaskActionsProps) {
  return (
    <section className="mb-6 hidden space-y-2 md:block">
      <h3 className="flex items-center gap-2 pl-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">
        <span className="h-1 w-1 rounded-full bg-gray-400" />
        {dictionary.toolsAndSettings}
      </h3>
      <div className="space-y-1.5 rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm">
        <WakeWordToggle dictionary={dictionary} {...wakeWord} />
        <ActionButton
          onClick={onCopy}
          label={dictionary.copy}
          icon={<CopyIcon className="h-4 w-4" />}
        />
        {isSignedIn && (
          <>
            <ActionButton
              onClick={onExportTasks}
              label={dictionary.export}
              tone="text-blue-600"
              icon={<ClipboardIcon className="h-4 w-4" />}
            />
            <ActionButton
              onClick={onExportCalendar}
              label={dictionary.exportCalendar}
              tone="text-blue-600"
              icon={<CalendarIcon className="h-4 w-4" />}
            />
          </>
        )}
      </div>
    </section>
  );
}
