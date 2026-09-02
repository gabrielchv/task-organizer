"use client";

import { useCallback, useRef, useState } from "react";
import { AuthButton } from "@/features/auth/AuthButton";
import { useAuth } from "@/features/auth/AuthProvider";
import { OptionsMenu } from "@/features/tasks/components/OptionsMenu";
import { TaskSidebar } from "@/features/tasks/components/TaskSidebar";
import { useTaskExport } from "@/features/tasks/hooks/useTaskExport";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import { useAudioRecorder } from "@/features/voice/hooks/useAudioRecorder";
import { useWakeWord } from "@/features/voice/hooks/useWakeWord";
import { ChatIcon, DotsIcon } from "@/components/icons";
import { Toast, useToast } from "@/components/Toast";
import { useChangeFlash } from "@/components/useChangeFlash";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { useChat } from "../hooks/useChat";
import { ChatComposer } from "./ChatComposer";
import { ChatMessages } from "./ChatMessages";

export function ChatScreen({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);
  const { user, loading: authLoading, getIdToken } = useAuth();
  const { toast, showToast } = useToast();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(
    null,
  );
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  const onGuestTasksMigrated = useCallback(
    () => showToast(dictionary.localSynced),
    [dictionary.localSynced, showToast],
  );

  const { tasks, isLoaded, tasksRef, toggleTask, deleteTask, replaceGuestTasks } =
    useTasks({
      user,
      authLoading,
      onGuestTasksMigrated,
    });

  // Covers both paths: a guest's list is replaced locally, a signed-in user's
  // arrives through the Firestore listener. Either way the newest timestamp
  // moves, which is what the flash keys off.
  const tasksChanged = useChangeFlash(
    tasks.reduce(
      (latest, task) => (task.updatedAt > latest ? task.updatedAt : latest),
      "",
    ),
  );

  const { messages, input, setInput, isSending, send } = useChat({
    locale,
    dictionary,
    getIdToken,
    isSignedIn: Boolean(user),
    tasksRef,
    onGuestTasks: replaceGuestTasks,
    showToast,
  });

  const recorder = useAudioRecorder({
    locale,
    onRecorded: (audio) => void send(audio),
    onTooShort: () => showToast(dictionary.holdToRecord),
    onMicrophoneDenied: () => showToast(dictionary.micDenied),
  });

  const wakeWord = useWakeWord(locale, recorder.isRecording, recorder.startHandsFree);

  const exportTools = useTaskExport({ tasks, dictionary, showToast });

  const toolProps = {
    isWakeWordEnabled: wakeWord.isEnabled,
    isWakeWordLoading: wakeWord.isLoading,
    onToggleWakeWord: wakeWord.toggle,
    onCopy: () => void exportTools.copyList(),
    onExportTasks: () => void exportTools.exportToGoogleTasks(),
    onExportCalendar: () => void exportTools.exportToCalendar(),
  };

  const toggleMenu = () => {
    if (isMenuOpen) {
      setMenuOpen(false);
      return;
    }
    const rect = menuTriggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuAnchor({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  };

  return (
    <div className="fixed inset-0 flex h-[100dvh] items-center justify-center overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="relative flex h-full w-full flex-col overflow-hidden border border-gray-200/50 bg-white shadow-2xl md:h-[95vh] md:w-[95vw] md:max-w-5xl md:flex-row md:rounded-3xl">
        <Toast toast={toast} />

        <div
          className={`min-w-0 flex-1 flex-col overflow-hidden border-r border-gray-100 bg-white ${
            isSidebarOpen ? "hidden md:flex" : "flex"
          }`}
        >
          <header className="z-30 flex min-h-15 shrink-0 items-center justify-between border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 p-4 shadow-sm md:h-18">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 shadow-sm">
                <ChatIcon className="h-4 w-4 text-white" />
              </span>
              <h1 className="text-lg font-bold tracking-tight text-gray-800">
                {dictionary.title}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                ref={menuTriggerRef}
                type="button"
                onClick={toggleMenu}
                aria-label={dictionary.openMenu}
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 active:scale-95 md:hidden"
              >
                <DotsIcon />
              </button>
              <AuthButton
                signInLabel={dictionary.signIn}
                signOutLabel={dictionary.signOut}
              />
            </div>
          </header>

          <ChatMessages messages={messages} dictionary={dictionary} />

          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={() => void send(input)}
            onOpenTasks={() => setSidebarOpen(true)}
            onRecordStart={recorder.start}
            onRecordStop={recorder.stop}
            isSending={isSending}
            isRecording={recorder.isRecording}
            isWakeWordRecording={recorder.isHandsFree}
            tasksChanged={tasksChanged}
            dictionary={dictionary}
          />
        </div>

        <TaskSidebar
          isOpen={isSidebarOpen}
          onClose={() => setSidebarOpen(false)}
          tasks={tasks}
          isLoaded={isLoaded}
          locale={locale}
          dictionary={dictionary}
          isSignedIn={Boolean(user)}
          onToggleTask={(id) => void toggleTask(id)}
          onDeleteTask={(id) => void deleteTask(id)}
          {...toolProps}
        />

        <OptionsMenu
          isOpen={isMenuOpen}
          anchor={menuAnchor}
          onClose={() => setMenuOpen(false)}
          triggerRef={menuTriggerRef}
          dictionary={dictionary}
          isSignedIn={Boolean(user)}
          canShare={typeof navigator !== "undefined" && "share" in navigator}
          onShare={() => void exportTools.shareList()}
          {...toolProps}
        />
      </div>
    </div>
  );
}
