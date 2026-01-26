import { Task } from "../types";

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

const DesktopActionBtn = ({ onClick, icon, label, color = "text-gray-700" }: any) => (
  <button onClick={onClick} className={`w-full text-left px-3 py-2.5 text-sm ${color} hover:bg-gray-50 rounded-lg flex items-center gap-3 transition-all duration-200 cursor-pointer border border-transparent hover:border-gray-200 active:scale-[0.98]`}>
    <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center">
      {icon}
    </div>
    <span className="font-medium">{label}</span>
  </button>
);

interface TaskSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: Task[];
    isDataLoaded: boolean;
    onToggleTask: (id: string) => void;
    onDeleteTask: (id: string) => void;
    dict: any;
    user: any;
    lang: string;
    // Tools props
    isModelLoading: boolean;
    isWakeWordEnabled: boolean;
    onToggleWakeWord: () => void;
    onCopyList: () => void;
    onExportGoogle: () => void;
    onExportCalendar: () => void;
}

export default function TaskSidebar({ 
    isOpen, onClose, tasks, isDataLoaded, onToggleTask, onDeleteTask, dict, user, lang,
    isModelLoading, isWakeWordEnabled, onToggleWakeWord, onCopyList, onExportGoogle, onExportCalendar
}: TaskSidebarProps) {
  
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
    <div 
        className={`w-full md:w-80 lg:w-96 bg-gray-50 flex flex-col shrink-0 transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'} absolute md:relative inset-0 md:inset-auto z-40 md:z-10`}
    >
        <div className="p-4 bg-gradient-to-r from-white to-gray-50 border-b border-gray-200 flex justify-between items-center shadow-sm shrink-0 h-15 md:h-18">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-sm">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h2 className="font-bold text-gray-800 text-lg">{user ? dict.listTitleCloud : dict.listTitleLocal}</h2>
            </div>
            <button onClick={onClose} className="md:hidden text-blue-600 text-sm font-semibold cursor-pointer hover:text-blue-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50">{dict.backToChat}</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* TOOLS SECTION */}
            <div className="hidden md:block space-y-2 mb-6">
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider pl-3 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                Tools & Settings
              </h3>
              <div className="bg-white rounded-xl p-2.5 shadow-sm border border-gray-200 space-y-1.5">
                <button disabled={isModelLoading} onClick={onToggleWakeWord} className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 rounded-lg transition-all duration-200 cursor-pointer ${
                  isWakeWordEnabled 
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 font-semibold border border-green-200 shadow-sm' 
                    : 'hover:bg-gray-50 text-gray-700 border border-transparent hover:border-gray-200'
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isWakeWordEnabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <svg className={`w-4 h-4 ${isWakeWordEnabled ? 'text-green-600' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <div className="font-semibold">{dict.wakeWord}</div>
                    <span className="text-[10px] text-gray-500 font-normal truncate">{dict.wakeWordLabel}</span>
                  </div>
                  <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full ${isWakeWordEnabled ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>{isWakeWordEnabled ? dict.on : dict.off}</span>
                </button>
                <DesktopActionBtn onClick={onCopyList} label={dict.copy} icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>} />
                {user && (
                  <>
                    <DesktopActionBtn onClick={onExportGoogle} color="text-blue-600" label={dict.export} icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>} />
                    <DesktopActionBtn onClick={onExportCalendar} color="text-blue-600" label={dict.exportCalendar} icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>} />
                  </>
                )}
              </div>
            </div>

            {!isDataLoaded ? <TaskListSkeleton /> : tasks.length === 0 ? (
                <div className="text-center mt-16">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-gray-400 text-sm font-medium">{dict.noTasks}</p>
                  <p className="text-gray-300 text-xs mt-1">Add tasks via chat or voice</p>
                </div>
            ) : (
                Object.entries(groupedTasks).map(([category, items]) => (
                <div key={category} className="space-y-3">
                    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider pl-3 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                      {category}
                    </h3>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                        {items.map(task => (
                            <div key={task.id} className="p-3.5 pl-4 flex items-start gap-3 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent transition-all duration-200 group cursor-pointer active:scale-[0.98]" onClick={() => onToggleTask(task.id)}>
                            <button 
                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mt-0.5 transition-all duration-200 flex-shrink-0 ${
                                  task.status === 'completed' 
                                    ? 'bg-gradient-to-br from-green-500 to-green-600 border-green-500 shadow-sm shadow-green-500/20' 
                                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                                }`}
                            >
                                {task.status === 'completed' && (
                                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                            </button>
                            
                            <div className="flex-1 min-w-0 flex flex-col my-auto">
                                <div className={`text-sm break-words font-medium leading-snug ${
                                  task.status === 'completed' 
                                    ? 'text-gray-400 line-through decoration-gray-300' 
                                    : 'text-gray-800'
                                }`}>
                                {task.title}
                                </div>
                                {task.date && (
                                    <div className="text-[10px] text-blue-600 font-medium mt-1.5 flex items-center gap-1.5 bg-blue-50 px-2 py-0.5 rounded-md w-fit">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                    {formatDate(task.date)}
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }} 
                                className="text-gray-300 hover:text-red-500 p-2 -mt-1.5 transition-all duration-200 md:opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-md"
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
  );
}