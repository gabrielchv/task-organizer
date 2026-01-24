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
      className={`p-3 rounded-2xl max-w-[85%] text-sm shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-2 ${
        isUser 
          ? 'bg-blue-600 text-white self-end ml-auto rounded-tr-none' 
          : 'bg-white text-gray-800 self-start border border-gray-100 rounded-tl-none'
      }`}
    >
      {msg.audioUrl && (
        <div className="w-full min-w-[200px]">
          <audio 
            controls 
            src={msg.audioUrl} 
            className="w-full h-8 rounded opacity-90 contrast-125 mix-blend-screen cursor-pointer"
            style={{ filter: isUser ? 'invert(1) hue-rotate(180deg)' : 'none' }}
          />
        </div>
      )}

      {msg.audioUrl && msg.transcription && (
        <button 
          onClick={() => setShowTranscription(!showTranscription)}
          className="text-[10px] uppercase font-bold tracking-wider opacity-70 hover:opacity-100 transition-opacity self-start flex items-center gap-1 cursor-pointer"
        >
          {showTranscription ? dict.hideTranscription : dict.showTranscription}
        </button>
      )}

      {(!msg.audioUrl || showTranscription) && (
        <div className={`break-words leading-relaxed ${msg.audioUrl && isUser ? 'text-blue-100 italic' : ''}`}>
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
    <div ref={chatContainerRef} className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4 scroll-smooth pb-4 bg-gray-50/50">
      {messages.map((msg) => <ChatMessage key={msg.id} msg={msg} dict={dict} />)}
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-gray-400 ml-2">
          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div>
          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div>
        </div>
      )}
    </div>
  );
}