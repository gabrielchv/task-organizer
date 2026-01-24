import { Task } from "../types";

interface UseTaskToolsProps {
  tasks: Task[];
  user: any;
  googleAccessToken: string | null;
  signInWithGoogle: () => Promise<void>;
  dict: any;
  showToast: (msg: string) => void;
}

export function useTaskTools({ 
  tasks, user, googleAccessToken, signInWithGoogle, dict, showToast 
}: UseTaskToolsProps) {

  const handleCopyList = async () => {
    try {
      const list = tasks.map(t => `[${t.status === 'completed' ? 'x' : ' '}] ${t.title} (${t.date ? t.date : ''})`).join('\n');
      await navigator.clipboard.writeText(list);
      showToast(dict.listCopied);
    } catch (err) { 
        showToast(dict.error); 
    }
  };

  const handleShareList = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try { 
          await (navigator as any).share({ 
              title: dict.title, 
              text: tasks.map(t => `[${t.status === 'completed' ? 'x' : ' '}] ${t.title}`).join('\n') 
          }); 
      } catch (err) {}
    }
  };

  const exportToGoogleTasks = async () => {
    if (!user || !googleAccessToken) { 
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
        if (task.date) payload.due = task.date.length === 10 ? task.date + 'T00:00:00.000Z' : new Date(task.date).toISOString();
        
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
    if (!user || !googleAccessToken) { 
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
             const nextDay = new Date(task.date); nextDay.setDate(nextDay.getDate() + 1);
             end = { date: nextDay.toISOString().split('T')[0] };
         } else if (task.date) {
             const startDate = new Date(task.date);
             start = { dateTime: startDate.toISOString() };
             end = { dateTime: new Date(startDate.getTime() + 3600000).toISOString() };
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

  return { handleCopyList, handleShareList, exportToGoogleTasks, exportToCalendar };
}