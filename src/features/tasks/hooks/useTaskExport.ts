"use client";

import { useCallback } from "react";
import {
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_TASKS_SCOPE,
  useAuth,
} from "@/features/auth/AuthProvider";
import { interpolate, type Dictionary } from "@/i18n";
import { isAllDay } from "../dates";
import type { Task } from "../types";

const TASKS_ENDPOINT = "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks";
const CALENDAR_ENDPOINT =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const DEFAULT_EVENT_MINUTES = 60;

interface UseTaskExportOptions {
  tasks: readonly Task[];
  dictionary: Dictionary;
  showToast: (message: string) => void;
}

/** Turns a wall-clock due date into a Google Calendar start/end pair. */
export function toCalendarEvent(task: Task): { start: object; end: object } | null {
  if (!task.date) return null;

  if (isAllDay(task.date)) {
    const [year, month, day] = task.date.split("-").map(Number);
    if (year === undefined || month === undefined || day === undefined) return null;
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    return {
      start: { date: task.date },
      end: { date: next.toISOString().slice(0, 10) },
    };
  }

  // A timed task is local wall-clock, so it is sent as a naive dateTime plus
  // the viewer's zone rather than being converted to UTC first.
  const [datePart, timePart] = task.date.split("T");
  const [year, month, day] = (datePart ?? "").split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00").split(":").map(Number);
  if (year === undefined || month === undefined || day === undefined) return null;

  const start = new Date(year, month - 1, day, hour ?? 0, minute ?? 0);
  const end = new Date(start.getTime() + DEFAULT_EVENT_MINUTES * 60_000);

  return {
    start: { dateTime: toNaiveIso(start), timeZone: viewerTimeZone() },
    end: { dateTime: toNaiveIso(end), timeZone: viewerTimeZone() },
  };
}

const viewerTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** `YYYY-MM-DDTHH:mm:ss` in local time, which is what `timeZone` qualifies. */
function toNaiveIso(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

export function useTaskExport({ tasks, dictionary, showToast }: UseTaskExportOptions) {
  const { authorizeGoogle } = useAuth();

  const copyList = useCallback(async () => {
    const text = tasks
      .map((task) => `- [${task.status === "completed" ? "x" : " "}] ${task.title}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast(dictionary.listCopied);
    } catch {
      showToast(dictionary.error);
    }
  }, [dictionary, showToast, tasks]);

  const shareList = useCallback(async () => {
    if (!("share" in navigator)) return;
    try {
      await navigator.share({
        title: dictionary.title,
        text: tasks.map((task) => `- ${task.title}`).join("\n"),
      });
    } catch {
      // The user dismissing the share sheet is not an error.
    }
  }, [dictionary.title, tasks]);

  const exportItems = useCallback(
    async (
      pending: readonly Task[],
      scope: string,
      endpoint: string,
      toBody: (task: Task) => object | null,
    ) => {
      if (pending.length === 0) {
        showToast(dictionary.nothingToExport);
        return;
      }

      // The scope is requested here rather than at sign-in, so a user who never
      // exports is never asked for access to their Google account data.
      const accessToken = await authorizeGoogle([scope]).catch(() => null);
      if (!accessToken) {
        showToast(dictionary.exportFailed);
        return;
      }

      const outcomes = await Promise.all(
        pending.map(async (task) => {
          const body = toBody(task);
          if (!body) return false;
          try {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            });
            return response.ok;
          } catch {
            return false;
          }
        }),
      );

      const exported = outcomes.filter(Boolean).length;
      showToast(
        exported === 0
          ? dictionary.exportFailed
          : interpolate(dictionary.exported, { count: exported }),
      );
    },
    [authorizeGoogle, dictionary, showToast],
  );

  const exportToGoogleTasks = useCallback(
    () =>
      exportItems(
        tasks.filter((task) => task.status === "pending"),
        GOOGLE_TASKS_SCOPE,
        TASKS_ENDPOINT,
        (task) => ({
          title: task.title,
          ...(task.date
            ? {
                due: `${isAllDay(task.date) ? task.date : task.date.slice(0, 10)}T00:00:00.000Z`,
              }
            : {}),
        }),
      ),
    [exportItems, tasks],
  );

  const exportToCalendar = useCallback(
    () =>
      exportItems(
        tasks.filter((task) => task.status === "pending" && task.date),
        GOOGLE_CALENDAR_SCOPE,
        CALENDAR_ENDPOINT,
        (task) => {
          const event = toCalendarEvent(task);
          return event ? { summary: task.title, ...event } : null;
        },
      ),
    [exportItems, tasks],
  );

  return { copyList, shareList, exportToGoogleTasks, exportToCalendar };
}
