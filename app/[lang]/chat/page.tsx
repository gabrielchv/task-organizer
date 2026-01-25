"use client";

import { useState, useRef, useEffect, use } from "react";
import { useAuth } from "../../context/AuthContext";
import AuthButton from "../../components/AuthButton";
import ChatArea from "../../components/ChatArea";
import TaskSidebar from "../../components/TaskSidebar";
import MobileOptions from "../../components/MobileOptions";
import { getDictionary } from "../../lib/dictionaries";

// Hooks
import { useToast } from "../../hooks/useToast";
import { useTaskManager } from "../../hooks/useTaskManager";
import { useChat } from "../../hooks/useChat";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { useWakeWord } from "../../hooks/useWakeWord";
import { useTaskTools } from "../../hooks/useTaskTools";

export default function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const dict = getDictionary(lang);
  
  const { user, googleAccessToken, signInWithGoogle, loading: authLoading } = useAuth();
  
  // 1. Toast & Shared UI State
  const { toast, showToast } = useToast();
  const [showTaskMenuMobile, setShowTaskMenuMobile] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number, right: number } | null>(null);
  const [canShare, setCanShare] = useState(false);
  
  // Notification state for mobile button
  const [taskButtonGlow, setTaskButtonGlow] = useState(false);
  const isFirstRender = useRef(true);
  
  // 2. Core Logic Hooks
  // FIX: Call useTaskManager ONLY ONCE to ensure UI and Logic share the same state
  const { 
    tasks, 
    tasksRef, 
    isDataLoaded, 
    toggleTask, 
    deleteTask, 
    syncFirestoreFromAI, 
    saveLocal 
  } = useTaskManager(user, authLoading, dict, showToast);

  // Ref to track previous tasks for deep comparison
  const prevTasksRef = useRef(tasks);

  const optionsMenuRef = useRef<HTMLButtonElement>(null);

  const { 
    messages, inputVal, setInputVal, isLoading, handleSend 
  } = useChat({ lang, tasksRef, user, syncFirestoreFromAI, saveLocal, dict, showToast });

  const { 
    handleCopyList, handleShareList, exportToGoogleTasks, exportToCalendar 
  } = useTaskTools({ tasks, user, googleAccessToken, signInWithGoogle, dict, showToast });

  const { 
    isRecording, isWakeWordTriggered, startRecordingLogic, stopRecordingLogic, triggerWakeWordRecording 
  } = useAudioRecorder({ 
      onRecordingComplete: (blob) => handleSend(blob, true), 
      showToast, 
      dict 
  });

  const { 
    isModelLoading, isWakeWordEnabled, setIsWakeWordEnabled 
  } = useWakeWord(isRecording, triggerWakeWordRecording, lang);

  // 3. UI Event Handling
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  // Effect to glow the button ONLY when tasks content actually changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevTasksRef.current = tasks;
      return;
    }
    
    // Deep compare to avoid glowing on same-data updates
    const hasChanged = JSON.stringify(tasks) !== JSON.stringify(prevTasksRef.current);

    if (hasChanged) {
      setTaskButtonGlow(true);
      const timer = setTimeout(() => setTaskButtonGlow(false), 1000);
      prevTasksRef.current = tasks;
      return () => clearTimeout(timer);
    }
  }, [tasks]);

  const toggleOptionsMenu = () => {
    if (isOptionsMenuOpen) {
      setIsOptionsMenuOpen(false);
    } else if (optionsMenuRef.current) {
      const rect = optionsMenuRef.current.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
      setIsOptionsMenuOpen(true);
    }
  };

  const handleButtonStart = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (isRecording && isWakeWordTriggered) return;
      startRecordingLogic(false);
  };

  const handleButtonStop = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      stopRecordingLogic();
  };

  return (
    <div className="fixed inset-0 h-[100dvh] flex justify-center items-center bg-[#1a1a1a] overflow-hidden font-sans">
      <div className="w-full h-full md:h-[95vh] md:w-[95vw] md:rounded-2xl overflow-hidden md:max-w-5xl bg-gray-50 flex flex-col md:flex-row shadow-2xl relative">
        
        {/* TOAST */}
        {toast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide shadow-md z-50 animate-bounce whitespace-nowrap">
            {toast}
          </div>
        )}

        {/* LEFT: CHAT AREA */}
        <div className={`flex-1 flex flex-col min-w-0 overflow-hidden bg-white border-r border-gray-100 transition-all duration-300 ${showTaskMenuMobile ? 'hidden md:flex' : 'flex'}`}>
          <header className="bg-white border-b p-4 flex justify-between items-center shrink-0 z-30 shadow-sm min-h-15 md:h-18">
            <h1 className="font-bold text-gray-800 text-lg tracking-tight">{dict.title}</h1>
            <div className="flex items-center gap-2">
              {/* OPTIONS BURGER (Mobile Only) */}
              <button ref={optionsMenuRef} onClick={toggleOptionsMenu} className="md:hidden p-2 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
              </button>
              <AuthButton label={user ? dict.signOut : dict.signIn} />
            </div>
          </header>

          <ChatArea 
            messages={messages} 
            isLoading={isLoading} 
            dict={dict} 
          />

          <div className="bg-white border-t border-gray-200 shrink-0 safe-area-bottom z-30">
            <div className="p-3 flex gap-2 items-center max-w-3xl mx-auto w-full">
              
              {/* Task Menu Button with Glow Effect */}
              <button 
                onClick={() => setShowTaskMenuMobile(true)} 
                className={`md:hidden p-3 rounded-full transition-all duration-500 cursor-pointer ${
                  taskButtonGlow 
                    ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-105' 
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </button>
              
              <button 
                onMouseDown={handleButtonStart} onMouseUp={handleButtonStop} 
                onTouchStart={handleButtonStart} onTouchEnd={handleButtonStop} 
                className={`p-3 rounded-full transition-all duration-300 flex items-center justify-center shadow-sm select-none touch-none cursor-pointer ${isRecording ? (isWakeWordTriggered ? 'bg-indigo-500 text-white scale-110 ring-4 ring-indigo-200' : 'bg-red-500 text-white scale-110 ring-4 ring-red-100') : 'bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-95'}`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </button>
              
              <input 
                type="text" value={inputVal} 
                onChange={(e) => setInputVal(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleSend(inputVal, false)} 
                className="w-full bg-gray-50 border border-transparent rounded-full px-4 py-3 md:text-sm text-gray-800 focus:outline-none focus:bg-white focus:border-blue-100 focus:ring-2 focus:ring-blue-50 transition-all text-base" 
                placeholder={dict.placeholder} 
                disabled={isLoading || isRecording} 
              />
              
              <button onClick={() => handleSend(inputVal, false)} disabled={isLoading || !inputVal.trim()} className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-95 cursor-pointer">
                <svg className="h-5 w-5 transform rotate-90" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: TASK SIDEBAR */}
        <TaskSidebar 
          isOpen={showTaskMenuMobile}
          onClose={() => setShowTaskMenuMobile(false)}
          tasks={tasks}
          isDataLoaded={isDataLoaded}
          onToggleTask={toggleTask}
          onDeleteTask={deleteTask}
          dict={dict}
          user={user}
          lang={lang}
          isModelLoading={isModelLoading}
          isWakeWordEnabled={isWakeWordEnabled}
          onToggleWakeWord={() => { setIsWakeWordEnabled(!isWakeWordEnabled); showToast(isWakeWordEnabled ? `${dict.wakeWord} ${dict.off}` : `${dict.wakeWord} ${dict.on}`); }}
          onCopyList={handleCopyList}
          onExportGoogle={exportToGoogleTasks}
          onExportCalendar={exportToCalendar}
        />

        {/* MOBILE OPTIONS PORTAL */}
        <MobileOptions 
            isOpen={isOptionsMenuOpen}
            position={menuPosition}
            onClose={() => setIsOptionsMenuOpen(false)}
            dict={dict}
            user={user}
            isWakeWordEnabled={isWakeWordEnabled}
            isModelLoading={isModelLoading}
            onToggleWakeWord={() => { setIsWakeWordEnabled(!isWakeWordEnabled); showToast(isWakeWordEnabled ? `${dict.wakeWord} ${dict.off}` : `${dict.wakeWord} ${dict.on}`); }}
            onShare={handleShareList}
            onCopy={handleCopyList}
            onExportTasks={exportToGoogleTasks}
            onExportCalendar={exportToCalendar}
            canShare={canShare}
            triggerRef={optionsMenuRef}
        />
      </div>
    </div>
  );
}