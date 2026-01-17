"use client";

import { useState, useRef, useEffect, JSX } from "react";

// Type definition for returned tasks
interface Task {
  title: string;
}

interface ApiResponse {
  tasks?: Task[];
  error?: string;
}

export default function Home() {
  const [messages, setMessages] = useState<{ type: 'user' | 'bot'; content: string | JSX.Element }[]>([
    { type: 'bot', content: "Hello! Type or hold the mic to speak your tasks." }
  ]);
  const [inputVal, setInputVal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Refs for audio and scrolling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);

  // Auto-scroll whenever a message is added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // --- Audio Logic ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const duration = Date.now() - startTimeRef.current;
        if (duration < 500) {
          alert("Hold longer to record.");
          return;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        handleSend(audioBlob, true);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      alert("Please allow microphone access.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- Data Sending ---
  const handleSend = async (content: string | Blob, isAudio: boolean) => {
    if (!content) return;

    // Add user message to UI
    setMessages(prev => [...prev, { 
      type: 'user', 
      content: isAudio ? "🎤 Voice message" : (content as string) 
    }]);

    if (!isAudio) setInputVal("");
    setIsLoading(true);

    try {
      let response;
      if (isAudio) {
        const formData = new FormData();
        formData.append('audio', content as Blob);
        response = await fetch('/api/process', { method: 'POST', body: formData });
      } else {
        response = await fetch('/api/process', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: content }) 
        });
      }

      const data: ApiResponse = await response.json();

      if (data.tasks && data.tasks.length > 0) {
        // Format response as HTML list
        const taskList = (
          <div>
            <p className="font-bold mb-2">✅ Extracted Tasks:</p>
            <div className="space-y-2">
              {data.tasks.map((t, i) => (
                <div key={i} className="border-l-4 border-blue-500 pl-2 bg-gray-50 p-1 rounded-r">
                  <span className="text-gray-800">{t.title}</span>
                </div>
              ))}
            </div>
          </div>
        );
        setMessages(prev => [...prev, { type: 'bot', content: taskList }]);
      } else {
        setMessages(prev => [...prev, { type: 'bot', content: "No tasks identified or an error occurred." }]);
      }

    } catch (error) {
      setMessages(prev => [...prev, { type: 'bot', content: "Error processing request." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-dvh w-full justify-center">
      <div className="w-full h-full max-w-md bg-gray-100 flex flex-col shadow-2xl">
        
        {/* Header */}
        <header className="bg-blue-600 text-white text-center font-bold py-4 shadow-md z-10 shrink-0">
          AI Task Organizer
        </header>

        {/* Chat Area */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`p-3 rounded-lg shadow-sm max-w-[85%] text-sm ${
                msg.type === 'user' 
                  ? 'bg-blue-500 text-white self-end ml-auto' 
                  : 'bg-white text-gray-800 self-start'
              }`}
            >
              {msg.content}
            </div>
          ))}
          
          {isLoading && (
            <div className="bg-white p-3 rounded-lg shadow-sm max-w-[85%] text-sm text-gray-400 italic flex items-center gap-2">
               <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
               Gemini is processing...
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-200 shrink-0 safe-area-bottom">
          <div className="flex gap-2 items-center">
            {/* Mic Button */}
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`p-2.5 rounded-full transition-all flex items-center justify-center min-w-[40px] min-h-[40px] ${
                isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-600'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14c1.657 0 3-1.343 3-3V5a3 3 0 10-6 0v6c0 1.657 1.343 3 3 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(inputVal, false)}
              className="w-full border rounded-full px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type..."
              disabled={isLoading || isRecording}
            />
            
            {/* Send Button */}
            <button
              onClick={() => handleSend(inputVal, false)}
              disabled={isLoading || !inputVal.trim()}
              className="bg-blue-600 text-white p-2.5 rounded-full hover:bg-blue-700 flex items-center justify-center min-w-[40px] min-h-[40px] disabled:opacity-50"
            >
              <svg className="h-5 w-5 transform rotate-90" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
          
          <div className="mt-4 text-center">
             <a href="https://www.linkedin.com/in/gabriel-chv" target="_blank" className="text-[10px] text-gray-400 transition-all hover:text-blue-500 uppercase tracking-widest font-semibold">
                 Gabriel Chaves | LinkedIn
             </a>
          </div>
        </div>
      </div>
    </div>
);  
}