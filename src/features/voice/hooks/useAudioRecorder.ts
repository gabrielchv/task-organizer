"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadModel,
  startRecognition,
  type RecognitionSession,
} from "@/lib/vosk/recognizer";
import { languageFor } from "@/lib/vosk/models";

/** Below this, the press was a tap rather than a recording. */
const MIN_RECORDING_MS = 500;
/** Silence after the last recognised word before a hands-free take is cut. */
const SILENCE_MS = 1_500;
/** How long to wait for any speech at all before giving up. */
const NO_SPEECH_MS = 4_000;

/** Ordered by preference; Safari only supports the mp4 entries. */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

interface UseAudioRecorderOptions {
  locale: string;
  onRecorded: (audio: Blob) => void;
  onTooShort: () => void;
  onMicrophoneDenied: () => void;
}

export interface UseAudioRecorderResult {
  isRecording: boolean;
  isHandsFree: boolean;
  start: () => void;
  stop: () => void;
  startHandsFree: () => void;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useAudioRecorder({
  locale,
  onRecorded,
  onTooShort,
  onMicrophoneDenied,
}: UseAudioRecorderOptions): UseAudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isHandsFree, setIsHandsFree] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const pressedRef = useRef(false);
  const sessionRef = useRef<RecognitionSession | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callbacks = useRef({ onRecorded, onTooShort, onMicrophoneDenied });
  useEffect(() => {
    callbacks.current = { onRecorded, onTooShort, onMicrophoneDenied };
  }, [onRecorded, onTooShort, onMicrophoneDenied]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
  }, []);

  const stop = useCallback(() => {
    pressedRef.current = false;
    clearSilenceTimer();
    void sessionRef.current?.stop();
    sessionRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, [clearSilenceTimer]);

  useEffect(() => stop, [stop]);

  const begin = useCallback(
    async (handsFree: boolean) => {
      pressedRef.current = true;
      startedAtRef.current = Date.now();

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        pressedRef.current = false;
        setIsRecording(false);
        setIsHandsFree(false);
        callbacks.current.onMicrophoneDenied();
        return;
      }

      // The press may have ended while the permission prompt was open.
      if (!pressedRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        for (const track of stream.getTracks()) track.stop();
        const duration = Date.now() - startedAtRef.current;
        setIsRecording(false);
        setIsHandsFree(false);

        if (duration < MIN_RECORDING_MS) {
          callbacks.current.onTooShort();
          return;
        }
        // Strip the codec parameter: the server matches on the base type.
        const type =
          (recorder.mimeType || mimeType || "audio/webm").split(";")[0] ?? "audio/webm";
        callbacks.current.onRecorded(new Blob(chunksRef.current, { type }));
      };

      recorder.start();
      setIsRecording(true);
      setIsHandsFree(handsFree);

      if (!handsFree) return;

      // Hands-free takes end themselves: recognition tells us when speech
      // stopped, so the user never has to touch the screen.
      try {
        const model = await loadModel(languageFor(locale));
        const restartSilenceTimer = () => {
          clearSilenceTimer();
          silenceTimerRef.current = setTimeout(stop, SILENCE_MS);
        };

        sessionRef.current = await startRecognition(stream, model, undefined, {
          onPartial: (text) => {
            if (text.trim().length > 0) restartSilenceTimer();
          },
          onResult: (text) => {
            if (text.trim().length > 0) restartSilenceTimer();
          },
        });

        silenceTimerRef.current = setTimeout(stop, NO_SPEECH_MS);
      } catch {
        // Without silence detection the recording would never end on its own.
        stop();
      }
    },
    [clearSilenceTimer, locale, stop],
  );

  return {
    isRecording,
    isHandsFree,
    start: useCallback(() => void begin(false), [begin]),
    startHandsFree: useCallback(() => void begin(true), [begin]),
    stop,
  };
}
