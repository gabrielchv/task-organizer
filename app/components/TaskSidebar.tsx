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
}

export default function TaskSidebar({ 
    isOpen, onClose, tasks, isDataLoaded, onToggleTask, onDeleteTask, dict, user, lang 
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
        className={`absolute inset-0 z-20 bg-gray-50 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
        <div className="p-4 bg-white border-b flex justify-between items-center shadow-sm shrink-0">
            <h2 className="font-bold text-gray-700">{user ? dict.listTitleCloud : dict.listTitleLocal}</h2>
            <button onClick={onClose} className="text-blue-600 text-sm font-semibold cursor-pointer">{dict.backToChat}</button>
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
                            <div key={task.id} className="p-3 pl-4 flex items-start gap-3 hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => onToggleTask(task.id)}>
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
                                onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }} 
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
  );
}