"use client";

import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { firebaseDb } from "@/lib/firebase/client";
import { toDocument, toTask } from "../mapping";
import { clearGuestTasks, readGuestTasks, writeGuestTasks } from "../storage";
import type { Task } from "../types";

interface UseTasksOptions {
  user: User | null;
  authLoading: boolean;
  onGuestTasksMigrated: () => void;
}

export interface UseTasksResult {
  tasks: Task[];
  isLoaded: boolean;
  /** Snapshot for the request body; only sent when signed out. */
  tasksRef: React.RefObject<Task[]>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  /** Applies the list the API returned after an assistant turn (guests only). */
  replaceGuestTasks: (tasks: Task[]) => void;
}

/**
 * Owns the task list.
 *
 * Manual edits stay on the client so they feel instant and Firestore's listener
 * fans them out. Assistant edits are written by the server and arrive through
 * the same listener, which is why the old `syncFirestoreFromAI` — the function
 * that deleted anything missing from the model's reply — has no replacement.
 */
export function useTasks({
  user,
  authLoading,
  onGuestTasksMigrated,
}: UseTasksOptions): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const tasksRef = useRef<Task[]>([]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Records the uid whose guest tasks were already merged, so signing out and
  // back in does not re-run a migration that already cleared local storage.
  const migratedForRef = useRef<string | null>(null);
  const migrateCallback = useRef(onGuestTasksMigrated);
  useEffect(() => {
    migrateCallback.current = onGuestTasksMigrated;
  }, [onGuestTasksMigrated]);

  // `undefined` until Firebase has resolved the session, then a uid or null.
  const identity = authLoading ? undefined : (user?.uid ?? null);
  const [seenIdentity, setSeenIdentity] = useState<string | null | undefined>(undefined);

  // Adjusted during render rather than in an effect so the first painted frame
  // already shows the right list. localStorage is only touched once auth has
  // resolved, which never happens during server rendering.
  if (seenIdentity !== identity) {
    setSeenIdentity(identity);
    if (identity === null) {
      setTasks(readGuestTasks(localStorage));
      setIsLoaded(true);
    } else if (identity !== undefined) {
      setIsLoaded(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;

    const db = firebaseDb();
    const tasksCollection = collection(db, "users", user.uid, "tasks");

    if (migratedForRef.current !== user.uid) {
      migratedForRef.current = user.uid;
      const guestTasks = readGuestTasks(localStorage);
      if (guestTasks.length > 0) {
        const batch = writeBatch(db);
        for (const task of guestTasks) {
          batch.set(doc(tasksCollection, task.id), toDocument(task), { merge: true });
        }
        void batch
          .commit()
          .then(() => {
            clearGuestTasks(localStorage);
            migrateCallback.current();
          })
          .catch(() => {
            // Leave the local copy in place so the next sign-in retries.
            migratedForRef.current = null;
          });
      }
    }

    return onSnapshot(query(tasksCollection), (snapshot) => {
      setTasks(snapshot.docs.map((document) => toTask(document.id, document.data())));
      setIsLoaded(true);
    });
  }, [user, authLoading]);

  const toggleTask = useCallback(
    async (id: string) => {
      const task = tasksRef.current.find((candidate) => candidate.id === id);
      if (!task) return;

      const status: Task["status"] =
        task.status === "completed" ? "pending" : "completed";
      const updatedAt = new Date().toISOString();
      const next = tasksRef.current.map((candidate) =>
        candidate.id === id ? { ...candidate, status, updatedAt } : candidate,
      );

      setTasks(next);
      if (user) {
        await updateDoc(doc(firebaseDb(), "users", user.uid, "tasks", id), {
          status,
          updatedAt,
        });
      } else {
        writeGuestTasks(localStorage, next);
      }
    },
    [user],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const next = tasksRef.current.filter((task) => task.id !== id);
      setTasks(next);
      if (user) {
        await deleteDoc(doc(firebaseDb(), "users", user.uid, "tasks", id));
      } else {
        writeGuestTasks(localStorage, next);
      }
    },
    [user],
  );

  const replaceGuestTasks = useCallback((next: Task[]) => {
    setTasks(next);
    writeGuestTasks(localStorage, next);
  }, []);

  return useMemo(
    () => ({ tasks, isLoaded, tasksRef, toggleTask, deleteTask, replaceGuestTasks }),
    [tasks, isLoaded, toggleTask, deleteTask, replaceGuestTasks],
  );
}
