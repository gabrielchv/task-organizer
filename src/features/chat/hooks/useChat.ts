"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "@/features/tasks/types";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { ChatRequestError, streamChat, type ChatHistoryEntry } from "../api";
import type { ChatMessage } from "../types";

/** How many previous messages are replayed as context. */
const HISTORY_WINDOW = 8;

interface UseChatOptions {
  locale: Locale;
  dictionary: Dictionary;
  getIdToken: () => Promise<string | null>;
  isSignedIn: boolean;
  tasksRef: React.RefObject<Task[]>;
  onGuestTasks: (tasks: Task[]) => void;
  showToast: (message: string) => void;
}

export interface UseChatResult {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  isSending: boolean;
  send: (content: string | Blob) => Promise<void>;
}

export function useChat({
  locale,
  dictionary,
  getIdToken,
  isSignedIn,
  tasksRef,
  onGuestTasks,
  showToast,
}: UseChatOptions): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setMessages((current) =>
      current.length > 0
        ? current
        : [{ id: "greeting", role: "assistant", content: dictionary.greeting }],
    );
  }, [dictionary.greeting]);

  // Recorded audio is held as an object URL; release them when the view goes.
  useEffect(() => {
    return () => {
      for (const message of messagesRef.current) {
        if (message.audioUrl) URL.revokeObjectURL(message.audioUrl);
      }
    };
  }, []);

  const send = useCallback(
    async (content: string | Blob) => {
      const isAudio = content instanceof Blob;
      if (!isAudio && content.trim().length === 0) return;

      const userMessageId = crypto.randomUUID();
      const assistantMessageId = crypto.randomUUID();
      const audioUrl = isAudio ? URL.createObjectURL(content) : undefined;

      const history: ChatHistoryEntry[] = messagesRef.current
        .slice(-HISTORY_WINDOW)
        .filter((message) => message.id !== "greeting")
        .map((message) => ({
          role: message.role === "user" ? ("user" as const) : ("model" as const),
          text: message.transcription ?? message.content,
        }));

      setMessages((current) => [
        ...current,
        {
          id: userMessageId,
          role: "user",
          content: isAudio ? dictionary.voiceMessage : content,
          ...(audioUrl ? { audioUrl } : {}),
        },
        { id: assistantMessageId, role: "assistant", content: "", streaming: true },
      ]);

      if (!isAudio) setInput("");
      setIsSending(true);

      const patch = (id: string, update: Partial<ChatMessage>) =>
        setMessages((current) =>
          current.map((message) =>
            message.id === id ? { ...message, ...update } : message,
          ),
        );

      try {
        const stream = streamChat({
          ...(isAudio ? { audio: content } : { text: content }),
          history,
          locale,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          deviceType: window.innerWidth >= 768 ? "desktop" : "mobile",
          ...(isSignedIn ? {} : { tasks: tasksRef.current }),
          idToken: await getIdToken(),
        });

        let assistantText = "";

        for await (const event of stream) {
          switch (event.type) {
            case "transcription":
              patch(userMessageId, { transcription: event.text });
              break;
            case "text":
              assistantText += event.delta;
              patch(assistantMessageId, { content: assistantText });
              break;
            case "tasks":
              onGuestTasks(event.tasks);
              break;
            case "done":
              patch(assistantMessageId, {
                content: event.text || assistantText || dictionary.error,
                streaming: false,
              });
              break;
            case "error":
              patch(assistantMessageId, {
                content: dictionary.error,
                streaming: false,
                failed: true,
              });
              break;
            case "tool":
              break;
          }
        }

        patch(assistantMessageId, { streaming: false });
      } catch (error) {
        const message =
          error instanceof ChatRequestError && error.code === "rate_limited"
            ? dictionary.rateLimited
            : dictionary.connectionError;
        showToast(message);
        patch(assistantMessageId, { content: message, streaming: false, failed: true });
      } finally {
        setIsSending(false);
      }
    },
    [dictionary, getIdToken, isSignedIn, locale, onGuestTasks, showToast, tasksRef],
  );

  return { messages, input, setInput, isSending, send };
}
