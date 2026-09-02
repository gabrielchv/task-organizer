"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronIcon } from "@/components/icons";
import type { Dictionary } from "@/i18n";
import { parseRichText } from "../rich-text";
import type { ChatMessage } from "../types";

function RichText({ text }: { text: string }) {
  return (
    <>
      {parseRichText(text).map((segment, index) =>
        segment.type === "bold" ? (
          <strong key={index} className="font-bold">
            {segment.value}
          </strong>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </>
  );
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2 text-gray-500">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-2 w-2 animate-bounce rounded-full bg-blue-500"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
      <span className="ml-1 text-xs text-gray-400">{label}</span>
    </span>
  );
}

function MessageBubble({
  message,
  dictionary,
}: {
  message: ChatMessage;
  dictionary: Dictionary;
}) {
  const [showTranscription, setShowTranscription] = useState(false);
  const isUser = message.role === "user";

  return (
    <li
      className={`flex max-w-[85%] flex-col gap-2 rounded-2xl p-4 text-sm shadow-md ${
        isUser
          ? "ml-auto self-end rounded-tr-none bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-blue-500/20"
          : "self-start rounded-tl-none border border-gray-200 bg-white text-gray-800 shadow-gray-200/50"
      } ${message.failed ? "border-red-200 bg-red-50 text-red-700" : ""}`}
    >
      {message.audioUrl && (
        <audio
          controls
          src={message.audioUrl}
          preload="metadata"
          playsInline
          className="h-8 w-full min-w-[200px] rounded-lg"
        />
      )}

      {message.audioUrl && message.transcription && (
        <button
          type="button"
          onClick={() => setShowTranscription((value) => !value)}
          aria-expanded={showTranscription}
          className="flex cursor-pointer items-center gap-1.5 self-start rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider opacity-80 transition-all hover:bg-white/10 hover:opacity-100"
        >
          {showTranscription
            ? dictionary.hideTranscription
            : dictionary.showTranscription}
          <ChevronIcon up={showTranscription} />
        </button>
      )}

      {(!message.audioUrl || showTranscription) && (
        <div className="leading-relaxed break-words">
          {message.audioUrl ? (
            (message.transcription ?? dictionary.transcribing)
          ) : message.streaming && message.content.length === 0 ? (
            <TypingIndicator label={dictionary.thinking} />
          ) : (
            <RichText text={message.content} />
          )}
        </div>
      )}
    </li>
  );
}

export function ChatMessages({
  messages,
  dictionary,
}: {
  messages: ChatMessage[];
  dictionary: Dictionary;
}) {
  const containerRef = useRef<HTMLUListElement>(null);
  const lastMessage = messages.at(-1);

  useEffect(() => {
    // Runs after paint, so the new bubble is already measured. The previous
    // version guessed with a 250ms timeout.
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages.length, lastMessage?.content]);

  return (
    <ul
      ref={containerRef}
      aria-live="polite"
      aria-relevant="additions text"
      className="flex min-h-0 flex-1 list-none flex-col gap-4 overflow-y-auto bg-gradient-to-b from-gray-50/50 to-white p-4 md:p-6"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} dictionary={dictionary} />
      ))}
    </ul>
  );
}
