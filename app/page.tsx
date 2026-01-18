"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import AuthButton from "./components/AuthButton";
import { db } from "./lib/firebase";
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch 
} from "firebase/firestore";

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'completed';
}

interface ApiResponse {
  summary: string;
  tasks: Task[];
  error?: string;
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  
  // --- STATE ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<{ type: 'user' | 'bot'; content: string }[]>([
    { type: 'bot', content: "Hello! What tasks do we need to organize?" }
  ]);
  
  const [inputVal, setInputVal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);

  // --- DATA SYNC LOGIC ---

  useEffect(() => {
    if (authLoading) return;

    if (user) {
      // 1. LOGGED IN: Listen to Firestore
      const q = query(collection(db, "users", user.uid, "tasks"));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const dbTasks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Task[];
        
        console.log("🔥 [Firestore] Loaded tasks:", dbTasks.length);
        setTasks(dbTasks);
      }, (error) => {
        console.error("🔥 [Firestore] Error:", error);
        if (error.code === 'permission-denied') {
          showToast("❌ Database Permission Denied. Check Rules.");
        }
      });
      return () => unsubscribe();
    } else {
      // 2. GUEST: Load from LocalStorage
      const saved = localStorage.getItem("guest_tasks");
      if (saved) setTasks(JSON.parse(saved));
    }
  }, [user, authLoading]);

  // Helper for Guest Mode
  const saveLocal = (newTasks: Task[]) => {
    setTasks(newTasks);
    localStorage.setItem("guest_tasks", JSON.stringify(newTasks));
  };

  // --- ACTIONS ---

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';

    // Optimistic UI Update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid, "tasks", taskId), { status: newStatus }, { merge: true });
      } catch (e) {
        console.error("Error updating task:", e);
        showToast("❌ Failed to save update");
      }
    } else {
      const newTasks = tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
      saveLocal(newTasks as Task[]);
    }
  };

  const deleteTask = async (taskId: string) => {
    // Optimistic UI Update
    setTasks(prev => prev.filter(t => t.id !== taskId));

    if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "tasks", taskId));
      } catch (e) {
        console.error("Error deleting task:", e);
        showToast("❌ Failed to delete task");
      }
    } else {
      saveLocal(tasks.filter(t => t.id !== taskId));
    }
  };

  const syncFirestoreFromAI = async (newTasksState: Task[]) => {
    if (!user) return;
    
    try {
      const batch = writeBatch(db);
      const userTasksRef = collection(db, "users", user.uid, "tasks");

      // 1. Delete tasks missing from AI response (ONLY if we had tasks to begin with)
      const newIds = new Set(newTasksState.map(t => t.id));
      tasks.forEach(currentTask => {
        if (!newIds.has(currentTask.id)) {
          batch.delete(doc(userTasksRef, currentTask.id));
        }
      });

      // 2. Add/Update tasks from AI response
      newTasksState.forEach(newTask => {
        const docRef = doc(userTasksRef, newTask.id);
        batch.set(docRef, newTask, { merge: true });
      });

      await batch.commit();
      console.log("✅ [Sync] Saved to Firestore successfully");
    } catch (e: any) {
      console.error("❌ [Sync] Save Failed:", e);
      if (e.code === 'permission-denied') {
         showToast("❌ Cloud Save Failed: Permission Denied");
      } else {
         showToast("❌ Cloud Save Failed");
      }
    }
  };

  // --- HANDLERS ---

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startTimeRef.current = Date.now();
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const duration = Date.now() - startTimeRef.current;
        if (duration < 500) {
          showToast("⚠️ Hold to record audio");
          setIsRecording(false);
          return;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        handleSend(audioBlob, true);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      showToast("❌ Microphone access denied");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSend = async (content: string | Blob, isAudio: boolean) => {
    if (!isAudio && !(content as string).trim()) return;

    setMessages(prev => [...prev, { 
      type: 'user', 
      content: isAudio ? "🎤 Voice message" : (content as string) 
    }]);

    if (!isAudio) setInputVal("");
    setIsLoading(true);
    if (isAudio) setIsRecording(false);

    try {
      let response;
      if (isAudio) {
        const formData = new FormData();
        formData.append('audio', content as Blob);
        formData.append('currentTasks', JSON.stringify(tasks));
        response = await fetch('/api/process', { method: 'POST', body: formData });
      } else {
        response = await fetch('/api/process', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: content, currentTasks: tasks }) 
        });
      }

      const data: ApiResponse = await response.json();

      if (data.tasks) {
        setMessages(prev => [...prev, { type: 'bot', content: data.summary || "List updated." }]);
        setIsLoading(false); 

        if (user) {
          // We wait for the sync to ensure data is saved
          await syncFirestoreFromAI(data.tasks);
        } else {
          saveLocal(data.tasks);
        }
      } else {
        setMessages(prev => [...prev, { type: 'bot', content: "I didn't understand. Try again." }]);
        setIsLoading(false);
      }

    } catch (error) {
      console.error("HandleSend Error:", error);
      showToast("Error connecting to server.");
      setMessages(prev => [...prev, { type: 'bot', content: "Connection error." }]);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex justify-center bg-[#1a1a1a] overflow-hidden overscroll-none font-sans">
      <div className="w-full h-full max-w-md bg-gray-50 flex flex-col shadow-2xl relative">
        
        {/* HEADER */}
        <header className="bg-white border-b p-4 flex justify-between items-center shrink-0 z-10 shadow-sm">
          <h1 className="font-bold text-gray-800 text-lg tracking-tight">Task Helper AI</h1>
          <AuthButton />
        </header>

        {/* TOAST */}
        {toast && (
          <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide shadow-md z-50 animate-bounce">
            {toast}
          </div>
        )}

        {/* CHAT AREA */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`p-3 rounded-2xl max-w-[85%] text-sm shadow-sm ${
                msg.type === 'user' 
                  ? 'bg-blue-600 text-white self-end ml-auto rounded-tr-none' 
                  : 'bg-white text-gray-800 self-start border border-gray-100 rounded-tl-none'
              }`}
            >
              {msg.content}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-400 ml-2">
               <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
               <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div>
               <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div>
            </div>
          )}
        </div>

        {/* TASK LIST AREA */}
        {tasks.length > 0 && (
          <div className="shrink-0 max-h-[35%] overflow-y-auto bg-white border-t border-gray-200 shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.1)] z-10">
            <div className="p-2 bg-gray-50 border-b border-gray-100 sticky top-0 flex justify-between items-center px-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {user ? "Cloud List" : "Local List"} ({tasks.length})
              </span>
            </div>
            
            <div className="divide-y divide-gray-50">
              {tasks.map((task) => (
                <div key={task.id} className="p-3 pl-4 flex items-center gap-3 hover:bg-gray-50 transition-colors group">
                  <button 
                    onClick={() => toggleTask(task.id)}
                    className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${
                      task.status === 'completed' 
                        ? 'bg-green-500 border-green-500 hover:bg-green-600' 
                        : 'border-gray-300 hover:border-blue-500'
                    }`}
                  >
                    {task.status === 'completed' && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  
                  <span className={`text-sm flex-1 truncate ${task.status === 'completed' ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-800'}`}>
                    {task.title}
                  </span>

                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="text-gray-300 hover:text-red-500 p-2 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INPUT & CREDITS */}
        <div className="bg-white border-t border-gray-200 shrink-0 safe-area-bottom z-20 flex flex-col">
          <div className="p-4 flex gap-2 items-center">
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`p-3 rounded-full transition-all flex items-center justify-center shadow-sm select-none touch-none ${
                isRecording 
                  ? 'bg-red-500 text-white scale-110 ring-4 ring-red-100' 
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-95'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(inputVal, false)}
              className="flex-1 bg-gray-50 border border-transparent rounded-full px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-100 focus:ring-2 focus:ring-blue-50 transition-all"
              placeholder="Type a task..."
              disabled={isLoading || isRecording}
            />
            
            <button
              onClick={() => handleSend(inputVal, false)}
              disabled={isLoading || !inputVal.trim()}
              className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
            >
              <svg className="h-5 w-5 transform rotate-90" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
          <div className="pb-2 text-center">
             <a href="https://www.linkedin.com/in/gabriel-chv" target="_blank" rel="noreferrer" className="text-[10px] text-gray-400 uppercase tracking-widest font-bold hover:text-blue-500 transition-colors">
                 Gabriel Chaves | LinkedIn
             </a>
          </div>
        </div>
      </div>
    </div>
  );
}