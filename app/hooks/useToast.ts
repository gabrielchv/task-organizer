import { useState, useCallback, useRef } from "react";

export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setToast(msg);
    timeoutRef.current = setTimeout(() => {
      setToast(null);
      timeoutRef.current = null;
    }, 3000);
  }, []);

  return { toast, showToast };
}