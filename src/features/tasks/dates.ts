import { DUE_PATTERN } from "./operations";

export const DEFAULT_TIME_ZONE = "UTC";

/**
 * Validates an IANA timezone before it reaches `Intl`, which throws on garbage.
 * The value arrives from the browser, so it is untrusted input.
 */
export function isValidTimeZone(timeZone: string): boolean {
  if (!/^[A-Za-z0-9+_\-/]{1,64}$/.test(timeZone)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function safeTimeZone(timeZone: string | undefined | null): string {
  if (!timeZone || !isValidTimeZone(timeZone)) return DEFAULT_TIME_ZONE;
  return timeZone;
}

/**
 * The "today" line handed to the model.
 *
 * The previous version passed a bare ISO instant, which left the model to guess
 * the day: at 23:30 in São Paulo the UTC instant is already tomorrow, so "add
 * it for tomorrow" landed two days out. Naming the weekday, the local date and
 * the zone removes the guess.
 */
export function describeNow(now: Date, timeZone: string): string {
  const zone = safeTimeZone(timeZone);
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  return `${formatted} (${zone})`;
}

/** The user's local calendar date as `YYYY-MM-DD`, for resolving "today". */
export function localDateKey(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

export function isAllDay(due: string): boolean {
  return due.length === 10;
}

export function isValidDue(due: string): boolean {
  if (!DUE_PATTERN.test(due)) return false;
  const [datePart] = due.split("T");
  if (datePart === undefined) return false;
  const [year, month, day] = datePart.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  // Reject impossible calendar dates such as 2026-02-30, which the pattern allows.
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/** Renders a due date for display, without shifting it across a timezone. */
export function formatDue(due: string, locale: string): string {
  const [datePart, timePart] = due.split("T");
  if (datePart === undefined) return due;
  const [year, month, day] = datePart.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return due;

  // Constructed in local time on purpose: a due date is wall-clock, so it must
  // render as the same day everywhere rather than being converted.
  const date = new Date(year, month - 1, day);

  if (timePart === undefined) {
    return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(
      date,
    );
  }

  const [hour, minute] = timePart.split(":").map(Number);
  date.setHours(hour ?? 0, minute ?? 0);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
