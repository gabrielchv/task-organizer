import { useState, useRef, useEffect } from "react";
import { Message, Task, ApiResponse } from "../types";

interface UseChatProps {
  lang: string;
  tasksRef: React.MutableRefObject<Task[]>;
  user: any;
  syncFirestoreFromAI: (tasks: Task[]) => Promise<void>;
  saveLocal: (tasks: Task[]) => void;
  dict: any;
  showToast: (msg: string) => void;
}

export function useChat({ 
  lang, tasksRef, user, syncFirestoreFromAI, saveLocal, dict, showToast 
}: UseChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Initial greeting
  useEffect(() => {
    setMessages(prev => prev.length === 0 ? [{ id: 'init', type: 'bot', content: dict.greeting }] : prev);
  }, [dict.greeting]);

  const handleSend = async (content: string | Blob, isAudio: boolean) => {
    if (!isAudio && !(content as string).trim()) return;

    const msgId = Date.now().toString();
    const userContent = isAudio ? dict.voiceMessage : (content as string);
    const audioUrl = isAudio && content instanceof Blob ? URL.createObjectURL(content) : undefined;

    setMessages(prev => [...prev, { id: msgId, type: 'user', content: userContent, audioUrl }]);
    
    // Prepare history
    const history = messagesRef.current.slice(-6).map(m => ({ 
        role: m.type === 'user' ? 'User' : 'AI', 
        content: m.transcription || m.content || "" 
    }));

    if (!isAudio) setInputVal("");
    setIsLoading(true);

    try {
      let response;
      if (isAudio) {
        const formData = new FormData(); 
        formData.append('audio', content as Blob); 
        formData.append('currentTasks', JSON.stringify(tasksRef.current)); 
        formData.append('language', lang); 
        formData.append('history', JSON.stringify(history));
        
        response = await fetch('/api/process', { method: 'POST', body: formData });
      } else {
        response = await fetch('/api/process', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ text: content, currentTasks: tasksRef.current, language: lang, history }) 
        });
      }

      const data: ApiResponse = await response.json();

      // Update transcription if available
      if (isAudio && data.transcription) {
          setMessages(prev => prev.map(msg => msg.id === msgId ? { ...msg, transcription: data.transcription } : msg));
      }

      // Handle AI Response
      if (data.tasks) {
        setMessages(prev => [...prev, { id: Date.now().toString() + 'bot', type: 'bot', content: data.summary || dict.updated }]);
        if (user) await syncFirestoreFromAI(data.tasks); 
        else saveLocal(data.tasks);
      } else { 
        setMessages(prev => [...prev, { id: Date.now().toString() + 'err', type: 'bot', content: dict.error }]); 
      }
    } catch (error) { 
        showToast("Connection error"); 
    } finally { 
        setIsLoading(false); 
    }
  };

  return { messages, inputVal, setInputVal, isLoading, handleSend };
}