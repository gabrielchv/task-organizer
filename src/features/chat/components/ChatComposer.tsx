"use client";

import { ChatIcon, MicrophoneIcon, SendIcon } from "@/components/icons";
import type { Dictionary } from "@/i18n";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onOpenTasks: () => void;
  onRecordStart: () => void;
  onRecordStop: () => void;
  isSending: boolean;
  isRecording: boolean;
  isWakeWordRecording: boolean;
  tasksChanged: boolean;
  dictionary: Dictionary;
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  onOpenTasks,
  onRecordStart,
  onRecordStop,
  isSending,
  isRecording,
  isWakeWordRecording,
  tasksChanged,
  dictionary,
}: ChatComposerProps) {
  const micState = isRecording
    ? isWakeWordRecording
      ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white ring-4 ring-indigo-200/50"
      : "animate-pulse bg-gradient-to-br from-red-500 to-red-600 text-white ring-4 ring-red-200/50"
    : "bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-95";

  return (
    <div className="safe-area-bottom z-30 shrink-0 border-t border-gray-200 bg-gradient-to-t from-white via-white to-gray-50/50">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2.5 p-3 md:p-4">
        <button
          type="button"
          onClick={onOpenTasks}
          aria-label={dictionary.openTaskList}
          className={`shrink-0 cursor-pointer rounded-xl p-3 transition-all duration-500 md:hidden ${
            tasksChanged
              ? "scale-105 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] ring-2 ring-blue-400"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-95"
          }`}
        >
          <ChatIcon />
        </button>

        <button
          type="button"
          aria-label={dictionary.recordHint}
          aria-pressed={isRecording}
          onPointerDown={(event) => {
            event.preventDefault();
            if (isRecording && isWakeWordRecording) return;
            onRecordStart();
          }}
          onPointerUp={(event) => {
            event.preventDefault();
            onRecordStop();
          }}
          onPointerCancel={onRecordStop}
          className={`flex shrink-0 cursor-pointer touch-none select-none items-center justify-center rounded-xl p-3.5 shadow-md transition-all duration-300 ${micState}`}
        >
          <MicrophoneIcon />
        </button>

        <label className="sr-only" htmlFor="chat-input">
          {dictionary.placeholder}
        </label>
        <input
          id="chat-input"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSend();
          }}
          placeholder={dictionary.placeholder}
          disabled={isSending || isRecording}
          // 16px on mobile keeps iOS Safari from zooming the viewport on focus.
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-800 shadow-sm transition-all hover:shadow-md focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
        />

        <button
          type="button"
          onClick={onSend}
          disabled={isSending || value.trim().length === 0}
          aria-label={dictionary.send}
          className="shrink-0 cursor-pointer rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 p-3.5 text-white shadow-md transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendIcon className="h-5 w-5 rotate-90" />
        </button>
      </div>
    </div>
  );
}
