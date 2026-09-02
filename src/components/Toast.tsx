"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VISIBLE_MS = 3_000;

export interface ToastState {
  id: number;
  message: string;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setToast({ id, message });

    if (timerRef.current) clearTimeout(timerRef.current);
    // Only dismiss the toast this call created; a newer one must not be cut
    // short by an older timer.
    timerRef.current = setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, VISIBLE_MS);
  }, []);

  useEffect(
    () => () => (timerRef.current ? clearTimeout(timerRef.current) : undefined),
    [],
  );

  return { toast, showToast };
}

export function Toast({ toast }: { toast: ToastState | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute left-1/2 top-16 z-50 -translate-x-1/2"
    >
      {toast && (
        <span className="block whitespace-nowrap rounded-full border border-yellow-300 bg-gradient-to-r from-yellow-400 to-yellow-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-yellow-900 shadow-lg">
          {toast.message}
        </span>
      )}
    </div>
  );
}
