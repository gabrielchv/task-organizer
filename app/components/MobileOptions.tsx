import { createPortal } from "react-dom";
import { useRef, useEffect } from "react";

interface MobileOptionsProps {
  isOpen: boolean;
  position: { top: number; right: number } | null;
  onClose: () => void;
  dict: any;
  user: any;
  isWakeWordEnabled: boolean;
  isModelLoading: boolean;
  onToggleWakeWord: () => void;
  onShare: () => void;
  onCopy: () => void;
  onExportTasks: () => void;
  onExportCalendar: () => void;
  canShare: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export default function MobileOptions({ 
    isOpen, position, onClose, dict, user, 
    isWakeWordEnabled, isModelLoading, onToggleWakeWord,
    onShare, onCopy, onExportTasks, onExportCalendar, canShare,
    triggerRef
}: MobileOptionsProps) {
  
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        // Do nothing if clicking inside the menu
        if (menuRef.current && menuRef.current.contains(target)) {
            return;
        }
        // Do nothing if clicking the trigger button (let the trigger handle toggling)
        if (triggerRef.current && triggerRef.current.contains(target)) {
            return;
        }
        
        onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen || !position) return null;

  return createPortal(
    <div 
        ref={menuRef}
        className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-48 py-1 overflow-hidden animate-in fade-in zoom-in-95" 
        style={{ top: position.top, right: position.right }}
    >
        <button 
            disabled={isModelLoading} 
            onClick={() => { onToggleWakeWord(); onClose(); }} 
            className={`w-full text-left px-4 py-3 text-sm flex items-center gap-2 transition-colors border-b ${isModelLoading ? 'opacity-50' : 'hover:bg-gray-50'}`}
        >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            <div className="flex-1 text-gray-700">{dict.wakeWord}</div>
            <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isWakeWordEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                {isWakeWordEnabled ? dict.on : dict.off}
            </div>
        </button>

        {canShare && (
            <button onClick={() => { onShare(); onClose(); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                {dict.share}
            </button>
        )}

        <button onClick={() => { onCopy(); onClose(); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
            {dict.copy}
        </button>

        {user && (
            <>
                <button onClick={() => { onExportTasks(); onClose(); }} className="w-full text-left px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 border-t flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                    {dict.export}
                </button>
                <button onClick={() => { onExportCalendar(); onClose(); }} className="w-full text-left px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    {dict.exportCalendar}
                </button>
            </>
        )}
    </div>,
    document.body
  );
}