import { useState, useEffect, useRef } from "react";
import { Message } from "../types";

// Helper to parse **bold** text without external libraries
const formatMessageContent = (text: string) => {
  if (!text) return null;
  // Split by bold markers (non-greedy)
  const parts = text.split(/(\*\*.*?\*\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
};

const ChatMessage = ({ msg, dict }: { msg: Message, dict: any }) => {
  const [showTranscription, setShowTranscription] = useState(false);
  const isUser = msg.type === 'user';

  return (
    <div 
      className={`p-4 rounded-2xl max-w-[85%] text-sm shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-2 ${
        isUser 
          ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white self-end ml-auto rounded-tr-none shadow-blue-500/20' 
          : 'bg-white text-gray-800 self-start border border-gray-200 rounded-tl-none shadow-gray-200/50'
      }`}
    >
      {msg.audioUrl && (
        <div className="w-full min-w-[200px]">
          <audio 
            controls 
            src={msg.audioUrl}
            preload="metadata"
            playsInline
            className="w-full h-8 rounded-lg opacity-90 contrast-125 mix-blend-screen cursor-pointer"
            style={{ filter: isUser ? 'invert(1) hue-rotate(180deg)' : 'none' }}
          />
        </div>
      )}

      {msg.audioUrl && msg.transcription && (
        <button 
          onClick={() => setShowTranscription(!showTranscription)}
          className="text-[10px] uppercase font-bold tracking-wider opacity-80 hover:opacity-100 transition-all self-start flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-md hover:bg-white/10"
        >
          {showTranscription ? dict.hideTranscription : dict.showTranscription}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={showTranscription ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
          </svg>
        </button>
      )}

      {(!msg.audioUrl || showTranscription) && (
        <div className={`break-words leading-relaxed ${msg.audioUrl && isUser ? 'text-blue-50 italic' : isUser ? 'text-gray-50' : 'text-gray-700'}`}>
           {msg.audioUrl 
             ? (msg.transcription || "Transcribing...") 
             : formatMessageContent(msg.content || "")
           }
        </div>
      )}
    </div>
  );
};

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  dict: any;
}

export default function ChatArea({ messages, isLoading, dict }: ChatAreaProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
      }
    }, 250);
  }, [messages, isLoading]);

  return (
    <div ref={chatContainerRef} className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6 space-y-4 scroll-smooth pb-4 bg-gradient-to-b from-gray-50/50 to-white">
      {messages.map((msg) => <ChatMessage key={msg.id} msg={msg} dict={dict} />)}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 ml-2 bg-white/80 backdrop-blur-sm px-4 py-3 rounded-2xl shadow-sm border border-gray-100 w-fit">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          <span className="ml-2 text-xs text-gray-400">{dict.thinking}</span>
        </div>
      )}
    </div>
  );
}