import { useState, useEffect, useRef } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch 
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Task } from "../types";

export function useTaskManager(user: any, authLoading: boolean, dict: any, showToast: (msg: string) => void) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  // Ref to access tasks inside async callbacks without dependency cycles
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // --- MIGRATION & SYNC ---
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      // 1. Migrate guest tasks if any
      const migrateGuestTasks = async () => {
        const savedGuest = localStorage.getItem("guest_tasks");
        if (!savedGuest) return;
        try {
          const localTasks: Task[] = JSON.parse(savedGuest);
          if (localTasks.length === 0) return;
          const batch = writeBatch(db);
          const userTasksRef = collection(db, "users", user.uid, "tasks");
          localTasks.forEach(task => {
            const docRef = doc(userTasksRef, task.id); 
            batch.set(docRef, task, { merge: true });
          });
          await batch.commit();
          localStorage.removeItem("guest_tasks");
          showToast(dict.localSynced);
        } catch (e) { console.error(e); }
      };

      migrateGuestTasks();

      // 2. Listen to Firestore
      const q = query(collection(db, "users", user.uid, "tasks"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const dbTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[];
        setTasks(dbTasks);
        setIsDataLoaded(true);
      });
      return () => unsubscribe();
    } else {
      // 3. Local Storage
      const saved = localStorage.getItem("guest_tasks");
      if (saved) setTasks(JSON.parse(saved));
      setIsDataLoaded(true);
    }
  }, [user, authLoading, dict.localSynced, showToast]);

  const saveLocal = (newTasks: Task[]) => {
    setTasks(newTasks);
    localStorage.setItem("guest_tasks", JSON.stringify(newTasks));
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

  const syncFirestoreFromAI = async (newTasksState: Task[]) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      const userTasksRef = collection(db, "users", user.uid, "tasks");
      const newIds = new Set(newTasksState.map(t => t.id));
      tasksRef.current.forEach(currentTask => {
        if (!newIds.has(currentTask.id)) batch.delete(doc(userTasksRef, currentTask.id));
      });
      newTasksState.forEach(newTask => {
        batch.set(doc(userTasksRef, newTask.id), newTask, { merge: true });
      });
      await batch.commit();
    } catch (e) { console.error(e); }
  };

  return {
    tasks,
    tasksRef,
    isDataLoaded,
    setTasks, // Exposed for manual updates if needed
    saveLocal,
    toggleTask,
    deleteTask,
    syncFirestoreFromAI
  };
}