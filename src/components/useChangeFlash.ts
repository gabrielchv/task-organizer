"use client";

import { useEffect, useState } from "react";

const FLASH_MS = 1_000;

/**
 * Briefly returns true whenever `signal` changes, skipping the first value.
 *
 * Used to highlight the task button when the list changes while it is hidden.
 * The previous implementation deep-compared the whole list with
 * `JSON.stringify` on every render; passing the latest `updatedAt` is both
 * cheaper and correct for edits that do not change the list's length.
 */
export function useChangeFlash(signal: string): boolean {
  const [seen, setSeen] = useState<string | null>(null);
  const [flashing, setFlashing] = useState(false);

  // Adjusting state during render rather than in an effect: React re-renders
  // immediately with the new value instead of painting a stale frame first.
  if (seen !== signal) {
    const isFirstValue = seen === null;
    setSeen(signal);
    if (!isFirstValue) setFlashing(true);
  }

  useEffect(() => {
    if (!flashing) return;
    const timer = setTimeout(() => setFlashing(false), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashing]);

  return flashing;
}
