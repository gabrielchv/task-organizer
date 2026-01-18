"use client";

import { useState, useRef, useEffect, use } from "react";
import { useAuth } from "../context/AuthContext";
import AuthButton from "../components/AuthButton";
import { db } from "../lib/firebase";
import { getDictionary } from "../lib/dictionaries";
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
  transcription?: string; // New field from API
  error?: string;
}

interface Message {
  id: string; // Added ID for reliable updates
  type: 'user' | 'bot';
  content?: string;
  audioUrl?: string; // For local audio playback
  transcription?: string; // The text transcription
}

// --- SKELETON LOADER ---
function TaskListSkeleton() {
  return (
    <div className="shrink-0 bg-white border-t border-gray-200 p-4 space-y-3 animate-pulse z-10">
      <div className="h-3 bg-gray-200 rounded w-1/4 mb-4"></div>
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>
  );
}

// --- SUB-COMPONENT FOR CHAT MESSAGES ---
// Handles the toggle state for transcription internally
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
      {/* Audio Player if URL exists */}
      {msg.audioUrl && (
        <div className="w-full min-w-[200px]">
          <audio 
            controls 
            src={msg.audioUrl} 
            className="w-full h-8 rounded opacity-90 contrast-125 mix-blend-screen"
            style={{ filter: isUser ? 'invert(1) hue-rotate(180deg)' : 'none' }}
          />
        </div>
      )}

      {/* Transcription Toggle (Only for audio messages that have a transcription) */}
      {msg.audioUrl && msg.transcription && (
        <button 
          onClick={() => setShowTranscription(!showTranscription)}
          className="text-[10px] uppercase font-bold tracking-wider opacity-70 hover:opacity-100 transition-opacity self-start flex items-center gap-1"
        >
          {showTranscription ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              {dict.hideTranscription}
            </>
          ) : (
             <>
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745A10.029 10.029 0 0018 10c-1.443-3.75-5.079-6.41-9.336-6.41a9.98 9.98 0 00-4.885 1.28L3.28 2.22zm8.397 8.397a2.5 2.5 0 00-3.535-3.536l3.535 3.536z" clipRule="evenodd" />
                  <path d="M11.96 13.02L9.432 10.493A2.5 2.5 0 0010 12.5c.66 0 1.284-.255 1.768-.707l.192.227z" />
                  <path fillRule="evenodd" d="M6.075 4.316A9.957 9.957 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186a9.96 9.96 0 01-2.288 3.323l-1.38-1.38A7.986 7.986 0 0017.5 10c-1.28-3.037-4.25-5.25-7.5-5.25a7.973 7.973 0 00-2.392.365L6.075 4.316z" clipRule="evenodd" />
               </svg>
               {dict.showTranscription}
             </>
          )}
        </button>
      )}

      {/* Text Content / Transcription */}
      {(!msg.audioUrl || showTranscription) && (
        <div className={`break-words ${msg.audioUrl && isUser ? 'text-blue-100 italic' : ''}`}>
           {msg.audioUrl ? (msg.transcription || "Transcribing...") : msg.content}
        </div>
      )}
    </div>
  );
};

export default function Home({ params }: { params: Promise<{ lang: string }> }) {
  // Unwrap params using React.use() or await (Next.js 15+ compatible)
  const { lang } = use(params);
  const dict = getDictionary(lang);

  const { user, googleAccessToken, signInWithGoogle, loading: authLoading } = useAuth();
  
  // --- STATE ---
  const [tasks, setTasks] = useState<Task[]>([]);
  
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Effect to set initial greeting when dict loads
  useEffect(() => {
    // Check if initial greeting already exists to avoid duplicates in strict mode
    setMessages(prev => {
        if (prev.length === 0) {
            return [{ id: 'init', type: 'bot', content: dict.greeting }];
        }
        return prev;
    });
  }, [dict.greeting]);
  
  const [inputVal, setInputVal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);

  // --- MIGRATION LOGIC (Guest -> Cloud) ---
  const migrateGuestTasks = async (userId: string) => {
    const savedGuest = localStorage.getItem("guest_tasks");
    if (!savedGuest) return;

    try {
      const localTasks: Task[] = JSON.parse(savedGuest);
      if (localTasks.length === 0) return;
      
      const batch = writeBatch(db);
      const userTasksRef = collection(db, "users", userId, "tasks");

      localTasks.forEach(task => {
        const docRef = doc(userTasksRef, task.id); 
        batch.set(docRef, task, { merge: true });
      });

      await batch.commit();
      
      localStorage.removeItem("guest_tasks");
      showToast(dict.localSynced);

    } catch (e) {
      console.error("[Migration] Failed:", e);
    }
  };

  // --- DATA SYNC LOGIC ---

  useEffect(() => {
    if (authLoading) return;

    if (user) {
      migrateGuestTasks(user.uid);

      const q = query(collection(db, "users", user.uid, "tasks"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const dbTasks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Task[];
        
        setTasks(dbTasks);
        setIsDataLoaded(true);
      }, (error) => {
        console.error("[Firestore] Error:", error);
        if (error.code === 'permission-denied') {
          showToast(dict.permissionDenied);
        }
        setIsDataLoaded(true);
      });
      return () => unsubscribe();

    } else {
      const saved = localStorage.getItem("guest_tasks");
      if (saved) setTasks(JSON.parse(saved));
      setIsDataLoaded(true);
    }
  }, [user, authLoading, dict]); 

  // Helper for Guest Mode
  const saveLocal = (newTasks: Task[]) => {
    setTasks(newTasks);
    localStorage.setItem("guest_tasks", JSON.stringify(newTasks));
  };

  // --- EXPORT TO GOOGLE TASKS ---
  const exportToGoogleTasks = async () => {
    if (!user) return;
    
    if (!googleAccessToken) {
      showToast("Please sign in again to enable export"); 
      await signInWithGoogle(); 
      return;
    }

    const pendingTasks = tasks.filter(t => t.status === 'pending');
    if (pendingTasks.length === 0) {
      showToast("No pending tasks");
      return;
    }

    showToast(`Exporting ${pendingTasks.length} tasks...`);
    
    try {
      let count = 0;
      for (const task of pendingTasks) {
        const response = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title: task.title })
        });
        
        if (response.ok) count++;
      }
      
      showToast(`Success: ${count} exported!`);
    } catch (error) {
      console.error(error);
      showToast("Failed to export");
    }
  };

  // --- ACTIONS ---

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';

    // Optimistic UI
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid, "tasks", taskId), { status: newStatus }, { merge: true });
      } catch (e) {
        console.error("Error updating task:", e);
      }
    } else {
      const newTasks = tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
      saveLocal(newTasks as Task[]);
    }
  };

  const deleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));

    if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "tasks", taskId));
      } catch (e) {
        console.error("Error deleting task:", e);
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

      const newIds = new Set(newTasksState.map(t => t.id));
      tasks.forEach(currentTask => {
        if (!newIds.has(currentTask.id)) {
          batch.delete(doc(userTasksRef, currentTask.id));
        }
      });

      newTasksState.forEach(newTask => {
        const docRef = doc(userTasksRef, newTask.id);
        batch.set(docRef, newTask, { merge: true });
      });

      await batch.commit();
    } catch (e: any) {
      console.error("[Sync] Save Failed:", e);
    }
  };

  // --- HANDLERS ---

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
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
          showToast(dict.holdToRecord);
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
      showToast("Microphone access denied");
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

    const msgId = Date.now().toString();

    // Optimistically add user message
    // If audio, creating a Blob URL for instant playback
    let audioUrl = undefined;
    if (isAudio && content instanceof Blob) {
        audioUrl = URL.createObjectURL(content);
    }

    setMessages(prev => [...prev, { 
      id: msgId,
      type: 'user', 
      content: isAudio ? dict.voiceMessage : (content as string),
      audioUrl: audioUrl
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
        formData.append('language', lang); 
        response = await fetch('/api/process', { method: 'POST', body: formData });
      } else {
        response = await fetch('/api/process', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: content, currentTasks: tasks, language: lang }) 
        });
      }

      const data: ApiResponse = await response.json();

      // Update the audio message with the transcription if available
      if (isAudio && data.transcription) {
          setMessages(prev => prev.map(msg => 
              msg.id === msgId ? { ...msg, transcription: data.transcription } : msg
          ));
      }

      if (data.tasks) {
        setMessages(prev => [...prev, { 
            id: Date.now().toString() + 'bot',
            type: 'bot', 
            content: data.summary || dict.updated 
        }]);
        setIsLoading(false); 

        if (user) {
          await syncFirestoreFromAI(data.tasks);
        } else {
          saveLocal(data.tasks);
        }
      } else {
        setMessages(prev => [...prev, { 
            id: Date.now().toString() + 'err',
            type: 'bot', 
            content: dict.error 
        }]);
        setIsLoading(false);
      }

    } catch (error) {
      console.error("HandleSend Error:", error);
      showToast("Error connecting to server.");
      setMessages(prev => [...prev, { 
          id: 'err-conn',
          type: 'bot', 
          content: "Connection error." 
      }]);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex justify-center items-center bg-[#1a1a1a] overflow-hidden overscroll-none font-sans">
      <div className="w-full h-full md:h-[90vh] md:rounded-2xl overflow-hidden max-w-md bg-gray-50 flex flex-col shadow-2xl relative">
        
        {/* HEADER */}
        <header className="bg-white border-b p-4 flex justify-between items-center shrink-0 z-10 shadow-sm min-h-[60px]">
          <h1 className="font-bold text-gray-800 text-lg tracking-tight">{dict.title}</h1>
          <AuthButton label={user ? dict.signOut : dict.signIn} />
        </header>

        {/* TOAST */}
        {toast && (
          <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide shadow-md z-50 animate-bounce">
            {toast}
          </div>
        )}

        {/* CHAT AREA */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 scroll-smooth">
          {messages.map((msg) => (
             <ChatMessage key={msg.id} msg={msg} dict={dict} />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-400 ml-2 animate-in fade-in">
               <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
               <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div>
               <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div>
            </div>
          )}
        </div>

        {/* LOADING STATE FOR LIST */}
        {!isDataLoaded && <TaskListSkeleton />}

        {/* TASK LIST AREA */}
        {isDataLoaded && tasks.length > 0 && (
          <div className="shrink-0 max-h-[35%] overflow-y-auto bg-white border-t border-gray-200 shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.1)] z-10 animate-in slide-in-from-bottom-5 duration-300">
            <div className="p-2 bg-gray-50 border-b border-gray-100 sticky top-0 flex justify-between items-center px-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {user ? dict.listTitleCloud : dict.listTitleLocal} ({tasks.length})
              </span>
              
              {/* EXPORT BUTTON */}
              {user && (
                <button 
                  onClick={exportToGoogleTasks}
                  className="text-[10px] flex items-center gap-1 text-blue-600 font-bold uppercase tracking-wide hover:underline disabled:opacity-50"
                  title="Export pending tasks to Google Tasks"
                >
                  {dict.export}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              )}
            </div>
            
            <div className="divide-y divide-gray-50">
              {tasks.map((task) => (
                <div key={task.id} className="p-3 pl-4 flex items-start gap-3 hover:bg-gray-50 transition-colors group">
                  <button 
                    onClick={() => toggleTask(task.id)}
                    className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all duration-200 ${
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
                  
                  <span className={`text-sm flex-1 break-words transition-all duration-200 ${task.status === 'completed' ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-800'}`}>
                    {task.title}
                  </span>

                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="text-gray-300 hover:text-red-500 p-2 -mt-1.5 transition-colors"
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
              className="w-full bg-gray-50 border border-transparent rounded-full px-4 py-3 text-base md:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-100 focus:ring-2 focus:ring-blue-50 transition-all"
              placeholder={dict.placeholder}
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