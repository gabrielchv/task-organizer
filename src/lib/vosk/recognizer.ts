"use client";

import type { KaldiRecognizer, Model } from "vosk-browser";
import { fetchModelBlob, type LoadProgress } from "./loader";
import type { VoskLanguage } from "./models";

const SAMPLE_RATE = 48_000;
const WORKLET_URL = "/worklets/pcm-forwarder.js";

export interface RecognitionHandlers {
  onResult?: (text: string) => void;
  onPartial?: (text: string) => void;
  onError?: (error: Error) => void;
}

export interface RecognitionSession {
  stop: () => Promise<void>;
}

/**
 * Models are expensive to build and are reused across start/stop cycles.
 * Keyed by language so switching locale does not leak the previous one.
 */
const modelCache = new Map<VoskLanguage, Promise<Model>>();

export async function loadModel(
  language: VoskLanguage,
  onProgress?: (progress: LoadProgress) => void,
): Promise<Model> {
  const cached = modelCache.get(language);
  if (cached) return cached;

  const pending = (async () => {
    // Imported here rather than at module scope: the Vosk glue code is large
    // and only a user who turns on voice ever needs it in their bundle.
    const { createModel } = await import("vosk-browser");
    const blob = await fetchModelBlob(language, onProgress);
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await createModel(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  })();

  modelCache.set(language, pending);
  pending.catch(() => modelCache.delete(language));
  return pending;
}

/**
 * Streams a microphone track through Vosk.
 *
 * Audio is captured by an AudioWorklet and handed over as raw Float32 frames,
 * so nothing but a `postMessage` happens on the audio thread.
 */
export async function startRecognition(
  stream: MediaStream,
  model: Model,
  grammar: string | undefined,
  handlers: RecognitionHandlers,
): Promise<RecognitionSession> {
  const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
  await audioContext.audioWorklet.addModule(WORKLET_URL);

  const recognizer: KaldiRecognizer = grammar
    ? new model.KaldiRecognizer(SAMPLE_RATE, grammar)
    : new model.KaldiRecognizer(SAMPLE_RATE);

  recognizer.on("result", (message) => {
    if (message.event === "result") handlers.onResult?.(message.result.text);
  });
  recognizer.on("partialresult", (message) => {
    if (message.event === "partialresult") handlers.onPartial?.(message.result.partial);
  });
  recognizer.on("error", (message) => {
    if (message.event === "error") handlers.onError?.(new Error(message.error));
  });

  const source = audioContext.createMediaStreamSource(stream);
  const worklet = new AudioWorkletNode(audioContext, "pcm-forwarder");

  worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
    recognizer.acceptWaveformFloat(event.data, SAMPLE_RATE);
  };

  source.connect(worklet);
  // Not connected to the destination: the previous implementation routed the
  // microphone into the speakers to keep the node alive, which an AudioWorklet
  // does not require.

  let stopped = false;
  return {
    stop: async () => {
      if (stopped) return;
      stopped = true;
      worklet.port.onmessage = null;
      worklet.disconnect();
      source.disconnect();
      recognizer.remove();
      await audioContext.close().catch(() => undefined);
    },
  };
}
