"use client";

import { useState, useRef, useEffect, use } from "react";
import { createPortal } from "react-dom"; 
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
  category?: string;
  date?: string | null;
}

interface ApiResponse {
  summary: string;
  tasks: Task[];
  transcription?: string;
  error?: string;
}

interface Message {
  id: string;
  type: 'user' | 'bot';
  content?: string;
  audioUrl?: string;
  transcription?: string;
}

// --- SUB-COMPONENTS ---

function TaskListSkeleton() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
      {[1, 2, 3].map(i => (
        <div key={i} className="flex flex-col gap-2">
           <div className="h-3 bg-gray-200 rounded w-1/4"></div>
           <div className="h-10 bg-gray-100 rounded w-full"></div>
        </div>
      ))}
    </div>
  );
}

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
        <div className={`break-words ${msg.audioUrl && isUser ? 'text-blue-100 italic' : ''}`}>
           {msg.audioUrl ? (msg.transcription || "Transcribing...") : msg.content}
        </div>
      )}
    </div>
  );
};

export default function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const dict = getDictionary(lang);
  
  const { user, googleAccessToken, signInWithGoogle, loading: authLoading } = useAuth();
  
  // --- STATE ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  // UI State
  const [showTaskMenu, setShowTaskMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number, right: number } | null>(null);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  
  // Feature flags
  const [canShare, setCanShare] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);
  const isPressingRef = useRef(false); // Tracks physical button state
  const optionsMenuRef = useRef<HTMLButtonElement>(null);
  const optionsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(prev => {
        if (prev.length === 0) return [{ id: 'init', type: 'bot', content: dict.greeting }];
        return prev;
    });
  }, [dict.greeting]);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  // Click Outside for Options Menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOptionsMenuOpen &&
        optionsMenuRef.current && 
        !optionsMenuRef.current.contains(event.target as Node) &&
        optionsDropdownRef.current &&
        !optionsDropdownRef.current.contains(event.target as Node)
      ) {
        setIsOptionsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOptionsMenuOpen]);

  const toggleOptionsMenu = () => {
    if (isOptionsMenuOpen) {
      setIsOptionsMenuOpen(false);
    } else {
      if (optionsMenuRef.current) {
        const rect = optionsMenuRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + 8, 
          right: window.innerWidth - rect.right
        });
      }
      setIsOptionsMenuOpen(true);
    }
  };

  // --- MIGRATION & SYNC ---
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
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      migrateGuestTasks(user.uid);
      const q = query(collection(db, "users", user.uid, "tasks"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const dbTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[];
        setTasks(dbTasks);
        setIsDataLoaded(true);
      });
      return () => unsubscribe();
    } else {
      const saved = localStorage.getItem("guest_tasks");
      if (saved) setTasks(JSON.parse(saved));
      setIsDataLoaded(true);
    }
  }, [user, authLoading]); 

  const saveLocal = (newTasks: Task[]) => {
    setTasks(newTasks);
    localStorage.setItem("guest_tasks", JSON.stringify(newTasks));
  };

  const syncFirestoreFromAI = async (newTasksState: Task[]) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      const userTasksRef = collection(db, "users", user.uid, "tasks");
      const newIds = new Set(newTasksState.map(t => t.id));
      tasks.forEach(currentTask => {
        if (!newIds.has(currentTask.id)) batch.delete(doc(userTasksRef, currentTask.id));
      });
      newTasksState.forEach(newTask => {
        batch.set(doc(userTasksRef, newTask.id), newTask, { merge: true });
      });
      await batch.commit();
    } catch (e) { console.error(e); }
  };

  // --- EXPORT & ACTIONS ---
  const getFormattedList = () => {
    return tasks.map(t => 
      `[${t.status === 'completed' ? 'x' : ' '}] ${t.title} (${t.date ? t.date : ''})`
    ).join('\n');
  };

  const handleCopyList = async () => {
    try {
      await navigator.clipboard.writeText(getFormattedList());
      showToast(dict.listCopied);
    } catch (err) { showToast(dict.error); }
    setIsOptionsMenuOpen(false);
  };

  const handleShareList = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as any).share({ title: dict.title, text: getFormattedList() });
      } catch (err) {}
    }
    setIsOptionsMenuOpen(false);
  };

  const exportToGoogleTasks = async () => {
    setIsOptionsMenuOpen(false);
    if (!user) return;
    if (!googleAccessToken) {
      showToast(dict.signIn + " again"); 
      await signInWithGoogle(); 
      return;
    }
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    if (pendingTasks.length === 0) { showToast("No pending tasks"); return; }
    showToast(`Exporting to Tasks...`);
    
    try {
      let count = 0;
      for (const task of pendingTasks) {
        const payload: any = { title: task.title };
        if (task.date) {
            if (task.date.length === 10) {
               payload.due = task.date + 'T00:00:00.000Z'; 
            } else {
               payload.due = new Date(task.date).toISOString();
            }
        }
        const response = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${googleAccessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) count++;
      }
      showToast(`Success: ${count} exported!`);
    } catch (error) { showToast("Failed to export"); }
  };

  const exportToCalendar = async () => {
    setIsOptionsMenuOpen(false);
    if (!user) return;
    if (!googleAccessToken) {
      showToast(dict.signIn + " again"); 
      await signInWithGoogle(); 
      return;
    }
    
    const datedTasks = tasks.filter(t => t.status === 'pending' && t.date);
    if (datedTasks.length === 0) { showToast("No dated tasks to export"); return; }
    showToast(`Exporting to Calendar...`);

    try {
      let count = 0;
      for (const task of datedTasks) {
         let start: any = {};
         let end: any = {};

         if (task.date && task.date.length === 10) {
             start = { date: task.date };
             const nextDay = new Date(task.date);
             nextDay.setDate(nextDay.getDate() + 1);
             end = { date: nextDay.toISOString().split('T')[0] };
         } else if (task.date) {
             const startDate = new Date(task.date);
             const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); 
             start = { dateTime: startDate.toISOString() };
             end = { dateTime: endDate.toISOString() };
         }

         const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${googleAccessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                summary: task.title,
                start,
                end
            })
         });
         if (response.ok) count++;
      }
      showToast(`Success: ${count} exported!`);
    } catch (e) { showToast("Failed to export"); }
  };

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus: Task['status'] = task.status === 'completed' ? 'pending' : 'completed';
    
    const newTasks = tasks.map(t => 
        t.id === taskId ? { ...t, status: newStatus } : t
    ) as Task[];
    
    setTasks(newTasks);

    if (user) {
      await setDoc(doc(db, "users", user.uid, "tasks", taskId), { status: newStatus }, { merge: true });
    } else {
      saveLocal(newTasks);
    }
  };

  const deleteTask = async (taskId: string) => {
    const newTasks = tasks.filter(t => t.id !== taskId);
    setTasks(newTasks);
    if (user) {
      await deleteDoc(doc(db, "users", user.uid, "tasks", taskId));
    } else {
      saveLocal(newTasks);
    }
  };

  // --- RECORDING & SENDING ---
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const startRecording = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Prevent ghost events
    isPressingRef.current = true;
    startTimeRef.current = Date.now();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // If user released button while waiting for permission/stream
      if (!isPressingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        showToast(dict.holdToRecord);
        return;
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const duration = Date.now() - startTimeRef.current;
        
        // Show warning if held for less than 500ms
        if (duration < 500) {
          showToast(dict.holdToRecord);
        } else {
          handleSend(new Blob(audioChunksRef.current, { type: 'audio/webm' }), true);
        }
        setIsRecording(false);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { 
      console.error(err);
      showToast("Microphone denied"); 
      setIsRecording(false);
      isPressingRef.current = false;
    }
  };

  const stopRecording = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isPressingRef.current = false;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSend = async (content: string | Blob, isAudio: boolean) => {
    if (!isAudio && !(content as string).trim()) return;
    const msgId = Date.now().toString();
    
    setMessages(prev => [...prev, { 
      id: msgId,
      type: 'user', 
      content: isAudio ? dict.voiceMessage : (content as string),
      audioUrl: isAudio && content instanceof Blob ? URL.createObjectURL(content) : undefined
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
      
      if (isAudio && data.transcription) {
          setMessages(prev => prev.map(msg => msg.id === msgId ? { ...msg, transcription: data.transcription } : msg));
      }

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

  // --- RENDER HELPERS ---
  
  const groupedTasks = tasks.reduce((acc, task) => {
    const cat = task.category || dict.uncategorized;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    
    if (dateStr.length === 10) {
         const [y, m, d] = dateStr.split('-').map(Number);
         const dateObj = new Date(y, m - 1, d);
         return dateObj.toLocaleDateString(lang, { month: 'short', day: 'numeric' });
    }

    const date = new Date(dateStr);
    return date.toLocaleDateString(lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 flex justify-center items-center bg-[#1a1a1a] overflow-hidden font-sans">
      <div className="w-full h-full md:h-[90vh] md:rounded-2xl overflow-hidden max-w-md bg-gray-50 flex flex-col shadow-2xl relative">
        
        {/* HEADER */}
        <header className="bg-white border-b p-4 flex justify-between items-center shrink-0 z-30 shadow-sm min-h-[60px]">
          <h1 className="font-bold text-gray-800 text-lg tracking-tight">{dict.title}</h1>
          <div className="flex items-center gap-2">
            <button 
              ref={optionsMenuRef}
              onClick={toggleOptionsMenu}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            <AuthButton label={user ? dict.signOut : dict.signIn} />
          </div>
        </header>

        {/* OPTIONS MENU PORTAL */}
        {isOptionsMenuOpen && menuPosition && createPortal(
          <div 
            ref={optionsDropdownRef}
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-48 py-1 overflow-hidden animate-in fade-in zoom-in-95"
            style={{ top: menuPosition.top, right: menuPosition.right }}
          >
             {canShare && (
                <button onClick={handleShareList} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                  {dict.share}
                </button>
             )}
             <button onClick={handleCopyList} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                {dict.copy}
             </button>
             {user && (
                <>
                  <button onClick={exportToGoogleTasks} className="w-full text-left px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 border-t flex items-center gap-2 cursor-pointer">
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                     {dict.export}
                  </button>
                  <button onClick={exportToCalendar} className="w-full text-left px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 cursor-pointer">
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                     {dict.exportCalendar}
                  </button>
                </>
             )}
          </div>,
          document.body
        )}

        {/* TOAST */}
        {toast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide shadow-md z-50 animate-bounce whitespace-nowrap">
            {toast}
          </div>
        )}

        {/* --- MAIN CONTENT AREA (Fills space between Header and Input) --- */}
        <div className="flex-1 relative overflow-hidden bg-gray-50">
          
          {/* CHAT VIEW */}
          <div 
            className={`absolute inset-0 flex flex-col transition-all duration-300 ${showTaskMenu ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'}`}
          >
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth pb-4">
              {messages.map((msg) => <ChatMessage key={msg.id} msg={msg} dict={dict} />)}
              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-gray-400 ml-2">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                </div>
              )}
            </div>
          </div>

          {/* TASK MENU VIEW (Separate Layer) */}
          <div 
            className={`absolute inset-0 z-20 bg-gray-50 flex flex-col transition-transform duration-300 ${showTaskMenu ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="p-4 bg-white border-b flex justify-between items-center shadow-sm shrink-0">
               <h2 className="font-bold text-gray-700">{user ? dict.listTitleCloud : dict.listTitleLocal}</h2>
               <button onClick={() => setShowTaskMenu(false)} className="text-blue-600 text-sm font-semibold cursor-pointer">{dict.backToChat}</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {!isDataLoaded ? <TaskListSkeleton /> : tasks.length === 0 ? (
                 <div className="text-center text-gray-400 mt-10 text-sm">{dict.noTasks}</div>
              ) : (
                 Object.entries(groupedTasks).map(([category, items]) => (
                    <div key={category} className="space-y-2">
                       <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">{category}</h3>
                       <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                          {items.map(task => (
                             <div key={task.id} className="p-3 pl-4 flex items-start gap-3 hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => toggleTask(task.id)}>
                                <button 
                                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 cursor-pointer ${task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}
                                >
                                  {task.status === 'completed' && <svg className="w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                </button>
                                
                                <div className="flex-1 min-w-0">
                                  <div className={`text-sm break-words ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                    {task.title}
                                  </div>
                                  {task.date && (
                                     <div className="text-[10px] text-blue-500 font-medium mt-0.5 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                        {formatDate(task.date)}
                                     </div>
                                  )}
                                </div>

                                <button 
                                  onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} 
                                  className="text-gray-300 hover:text-red-500 p-2 -mt-1.5 cursor-pointer"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                             </div>
                          ))}
                       </div>
                    </div>
                 ))
              )}
            </div>
          </div>
        </div>

        {/* INPUT BAR */}
        <div className="bg-white border-t border-gray-200 shrink-0 safe-area-bottom z-30">
          <div className="p-3 flex gap-2 items-center">
            
            {/* TASKS TOGGLE BUTTON (BOTTOM LEFT) */}
            <button
               onClick={() => setShowTaskMenu(!showTaskMenu)}
               className={`p-3 rounded-full transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${showTaskMenu ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
               title={dict.tasksMenu}
            >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
               </svg>
            </button>

            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`p-3 rounded-full transition-all flex items-center justify-center shadow-sm select-none touch-none cursor-pointer ${
                isRecording ? 'bg-red-500 text-white scale-110 ring-4 ring-red-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-95'
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
              className="w-full bg-gray-50 border border-transparent rounded-full px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-100 focus:ring-2 focus:ring-blue-50 transition-all"
              placeholder={dict.placeholder}
              disabled={isLoading || isRecording}
            />
            
            <button
              onClick={() => handleSend(inputVal, false)}
              disabled={isLoading || !inputVal.trim()}
              className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <svg className="h-5 w-5 transform rotate-90" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
          <div className="pb-2 text-center">
             <a href="https://www.linkedin.com/in/gabriel-chv" target="_blank" rel="noreferrer" className="text-[10px] text-gray-400 uppercase tracking-widest font-bold hover:text-blue-500 transition-colors cursor-pointer">
                 Gabriel Chaves | LinkedIn
             </a>
          </div>
        </div>

      </div>
    </div>
  );
}