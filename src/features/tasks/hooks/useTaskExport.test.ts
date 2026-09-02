import { describe, expect, it } from "vitest";
import { toCalendarEvent } from "./useTaskExport";
import type { Task } from "../types";

function task(date: string | null): Task {
  return {
    id: "a",
    title: "Dentist",
    status: "pending",
    category: "health",
    date,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  };
}

describe("toCalendarEvent", () => {
  it("returns null for a task with no date", () => {
    expect(toCalendarEvent(task(null))).toBeNull();
  });

  it("makes an all-day event span exactly one day", () => {
    expect(toCalendarEvent(task("2026-03-12"))).toEqual({
      start: { date: "2026-03-12" },
      end: { date: "2026-03-13" },
    });
  });

  it("rolls an all-day event over a month boundary", () => {
    expect(toCalendarEvent(task("2026-03-31"))).toMatchObject({
      end: { date: "2026-04-01" },
    });
  });

  it("gives a timed task a one-hour slot in the viewer's zone", () => {
    const event = toCalendarEvent(task("2026-03-12T14:00"));

    expect(event).toMatchObject({
      start: { dateTime: "2026-03-12T14:00:00" },
      end: { dateTime: "2026-03-12T15:00:00" },
    });
  });

  it("rolls a late event's end onto the next day instead of ending before it starts", () => {
    const event = toCalendarEvent(task("2026-03-12T23:30"));

    expect(event).toMatchObject({
      start: { dateTime: "2026-03-12T23:30:00" },
      end: { dateTime: "2026-03-13T00:30:00" },
    });
  });

  it("keeps the wall-clock time rather than converting it to UTC", () => {
    const event = toCalendarEvent(task("2026-03-12T09:15")) as {
      start: { dateTime: string; timeZone: string };
    };

    expect(event.start.dateTime).toBe("2026-03-12T09:15:00");
    expect(event.start.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});
