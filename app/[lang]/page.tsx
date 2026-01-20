"use client";

import { useState, useRef, useEffect, use } from "react";
import { createPortal } from "react-dom"; 
import { useAuth } from "../context/AuthContext";
import AuthButton from "../components/AuthButton";
import { getDictionary } from "../lib/dictionaries";

// Shared Types
import { Message, ApiResponse } from "../types";

// Hooks
import { useTaskManager } from "../hooks/useTaskManager";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useWakeWord } from "../hooks/useWakeWord";

// Components
import TaskSidebar from "../components/TaskSidebar";
import ChatArea from "../components/ChatArea";

export default function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const dict = getDictionary(lang);
  
  const { user, googleAccessToken, signInWithGoogle, loading: authLoading } = useAuth();
  
  // --- UI STATE ---
  const [showTaskMenu, setShowTaskMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number, right: number } | null>(null);
  const optionsMenuRef = useRef<HTMLButtonElement>(null);
  const optionsDropdownRef = useRef<HTMLDivElement>(null);
  const [canShare, setCanShare] = useState(false);

  // --- CHAT STATE ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Keep ref for history in callbacks
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // --- LOGIC HOOKS ---
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const { 
    tasks, tasksRef, isDataLoaded, saveLocal, toggleTask, deleteTask, syncFirestoreFromAI 
  } = useTaskManager(user, authLoading, dict, showToast);

  const { 
    isRecording, isWakeWordTriggered, startRecordingLogic, stopRecordingLogic, triggerWakeWordRecording 
  } = useAudioRecorder({
    onRecordingComplete: (blob) => handleSend(blob, true),
    showToast,
    dict
  });

  const { isModelLoading, isWakeWordEnabled, setIsWakeWordEnabled } = useWakeWord(isRecording, triggerWakeWordRecording);

  // --- INIT ---
  useEffect(() => {
    setMessages(prev => {
        if (prev.length === 0) return [{ id: 'init', type: 'bot', content: dict.greeting }];
        return prev;
    });
    setCanShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, [dict.greeting]);

  // --- API HANDLER ---
  const handleSend = async (content: string | Blob, isAudio: boolean) => {
    if (!isAudio && !(content as string).trim()) return;
    const msgId = Date.now().toString();
    
    setMessages(prev => [...prev, { 
      id: msgId,
      type: 'user', 
      content: isAudio ? dict.voiceMessage : (content as string),
      audioUrl: isAudio && content instanceof Blob ? URL.createObjectURL(content) : undefined
    }]);

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
          body: JSON.stringify({ 
             text: content, 
             currentTasks: tasksRef.current, 
             language: lang,
             history: history 
          }) 
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

  // --- ACTIONS (Exports/Sharing) ---
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
            if (task.date.length === 10) payload.due = task.date + 'T00:00:00.000Z'; 
            else payload.due = new Date(task.date).toISOString();
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
         let start: any = {}, end: any = {};
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
            body: JSON.stringify({ summary: task.title, start, end })
         });
         if (response.ok) count++;
      }
      showToast(`Success: ${count} exported!`);
    } catch (e) { showToast("Failed to export"); }
  };

  // --- MENU HANDLER ---
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

  // --- RENDER ---
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
             <button
               disabled={isModelLoading}
               onClick={() => {
                 setIsWakeWordEnabled(!isWakeWordEnabled);
                 setIsOptionsMenuOpen(false);
                 showToast(isWakeWordEnabled ? "Wake Word Disabled" : "Wake Word Enabled");
               }}
               className={`w-full text-left px-4 py-3 text-sm flex items-center gap-2 cursor-pointer border-b transition-colors ${
                 isModelLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
               }`}
             >
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <div className="flex-1 text-gray-700">Wake Word</div>
                <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isWakeWordEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                }`}>
                    {isWakeWordEnabled ? 'ON' : 'OFF'}
                </div>
             </button>

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

        {/* --- MAIN CONTENT AREA --- */}
        <div className="flex-1 relative overflow-hidden bg-gray-50">
          
          <ChatArea 
            messages={messages} 
            isLoading={isLoading} 
            dict={dict} 
            isHidden={showTaskMenu}
          />

          <TaskSidebar 
            isOpen={showTaskMenu}
            onClose={() => setShowTaskMenu(false)}
            tasks={tasks}
            isDataLoaded={isDataLoaded}
            onToggleTask={toggleTask}
            onDeleteTask={deleteTask}
            dict={dict}
            user={user}
            lang={lang}
          />
        </div>

        {/* INPUT BAR */}
        <div className="bg-white border-t border-gray-200 shrink-0 safe-area-bottom z-30">
          <div className="p-3 flex gap-2 items-center">
            
            {/* TASKS TOGGLE BUTTON */}
            <button
               onClick={() => setShowTaskMenu(!showTaskMenu)}
               className={`p-3 rounded-full transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${showTaskMenu ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
               title={dict.tasksMenu}
            >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
               </svg>
            </button>

            {/* MIC BUTTON */}
            <button
              onMouseDown={(e) => { e.preventDefault(); if(!(isRecording && isWakeWordTriggered)) startRecordingLogic(false); }}
              onMouseUp={(e) => { e.preventDefault(); stopRecordingLogic(); }}
              onTouchStart={(e) => { e.preventDefault(); if(!(isRecording && isWakeWordTriggered)) startRecordingLogic(false); }}
              onTouchEnd={(e) => { e.preventDefault(); stopRecordingLogic(); }}
              className={`p-3 rounded-full transition-all duration-300 flex items-center justify-center shadow-sm select-none touch-none cursor-pointer ${
                isRecording 
                  ? isWakeWordTriggered 
                     ? 'bg-indigo-500 text-white scale-110 ring-4 ring-indigo-200' 
                     : 'bg-red-500 text-white scale-110 ring-4 ring-red-100'       
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