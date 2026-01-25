import { useState, useEffect, useRef } from "react";
// @ts-ignore
import { createModel } from "vosk-browser";

// Configuration for supported languages
const MODEL_CONFIG: Record<string, { path: string; grammar: string }> = {
  en: {
    path: "/model/en/model.tar.gz",
    grammar: '["hey organizer", "[unk]"]',
  },
  pt: {
    path: "/model/pt/model.tar.gz",
    grammar: '["olá organizador", "[unk]"]',
  },
};

export function useWakeWord(
  isRecording: boolean,
  onWakeTrigger: () => void,
  lang: string = "en"
) {
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false); // New state: Is model loaded in memory?

  // Refs for persistent objects
  const recognizerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  const onWakeTriggerRef = useRef(onWakeTrigger);
  useEffect(() => {
    onWakeTriggerRef.current = onWakeTrigger;
  }, [onWakeTrigger]);

  // Preload Model on Mount (Background)
  useEffect(() => {
    let mounted = true;
    
    const loadModel = async () => {
      try {
        // If we already have a recognizer for this language, do nothing
        if (recognizerRef.current) return;

        console.log("Preloading Wake Word Model...");
        const safeLang = lang.startsWith("pt") ? "pt" : "en";
        const config = MODEL_CONFIG[safeLang];

        const model = await createModel(config.path);
        const recognizer = new model.KaldiRecognizer(48000, config.grammar);

        recognizer.on("result", (message: any) => {
          const result = message.result;
          if (result && result.text) {
             const text = result.text.toLowerCase();
             // Simple check for wake phrases
             if (text.includes("hey organizer") || text.includes("olá organizador")) {
                console.log("Wake word detected:", text);
                onWakeTriggerRef.current();
             }
          }
        });

        if (mounted) {
            recognizerRef.current = recognizer;
            setIsModelReady(true);
            console.log("Wake Word Model Ready!");
        }
      } catch (err) {
        console.error("Failed to preload model:", err);
      }
    };

    loadModel();

    // Cleanup ONLY on unmount (close the model completely)
    return () => {
      mounted = false;
      if (recognizerRef.current) {
        try { recognizerRef.current.remove(); } catch(e) {}
        recognizerRef.current = null;
      }
    };
  }, [lang]);

  useEffect(() => {
    // Helper to stop audio tracks but KEEP the model
    const stopAudio = () => {
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };

    const startListening = async () => {
      if (!isModelReady || !recognizerRef.current) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000
          }
        });
        streamRef.current = stream;

        const audioContext = new AudioContext({ sampleRate: 48000 });
        audioContextRef.current = audioContext;
        
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
            try {
                // Feed audio to the existing recognizer
                if (recognizerRef.current) {
                    recognizerRef.current.acceptWaveform(event.inputBuffer);
                }
            } catch (err) {
                console.error(err);
            }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      } catch (err) {
        console.error("Microphone error:", err);
        setIsWakeWordEnabled(false); // Turn off switch if mic fails
      }
    };

    // Logic Switch
    if (isWakeWordEnabled && !isRecording) {
      startListening();
    } else {
      stopAudio();
    }

    return () => {
      stopAudio();
    };
  }, [isWakeWordEnabled, isRecording, isModelReady]);

  return {
    isModelLoading: !isModelReady, // UI shows loading until preloading finishes
    isWakeWordEnabled,
    setIsWakeWordEnabled
  };
}