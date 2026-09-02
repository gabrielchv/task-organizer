"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LoadProgress } from "@/lib/vosk/loader";
import { languageFor, WAKE_GRAMMARS, WAKE_PHRASES } from "@/lib/vosk/models";
import {
  loadModel,
  startRecognition,
  type RecognitionSession,
} from "@/lib/vosk/recognizer";

export interface UseWakeWordResult {
  isEnabled: boolean;
  isLoading: boolean;
  progress: LoadProgress | null;
  toggle: () => void;
}

/**
 * Listens for the wake phrase while enabled.
 *
 * The ~40MB model is fetched the first time the user turns this on, not on page
 * load, and the listener is torn down while a recording is in progress so the
 * two do not compete for the microphone.
 */
export function useWakeWord(
  locale: string,
  isRecording: boolean,
  onWake: () => void,
): UseWakeWordResult {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<LoadProgress | null>(null);

  const sessionRef = useRef<RecognitionSession | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onWakeRef = useRef(onWake);
  useEffect(() => {
    onWakeRef.current = onWake;
  }, [onWake]);

  const teardown = useCallback(async () => {
    await sessionRef.current?.stop();
    sessionRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!isEnabled || isRecording) {
      void teardown();
      return;
    }

    let cancelled = false;
    const language = languageFor(locale);
    const phrase = WAKE_PHRASES[language];

    void (async () => {
      setIsLoading(true);
      try {
        const model = await loadModel(language, setProgress);
        if (cancelled) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;

        sessionRef.current = await startRecognition(
          stream,
          model,
          WAKE_GRAMMARS[language],
          {
            onResult: (text) => {
              if (text.toLowerCase().includes(phrase)) onWakeRef.current();
            },
          },
        );
      } catch {
        if (!cancelled) setIsEnabled(false);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setProgress(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      void teardown();
    };
  }, [isEnabled, isRecording, locale, teardown]);

  return {
    isEnabled,
    isLoading,
    progress,
    toggle: useCallback(() => setIsEnabled((value) => !value), []),
  };
}
