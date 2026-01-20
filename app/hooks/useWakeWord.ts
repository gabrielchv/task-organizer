import { useState, useEffect, useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import * as speechCommands from "@tensorflow-models/speech-commands";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";

export function useWakeWord(isRecording: boolean, onWakeTrigger: () => void) {
  const [model, setModel] = useState<speechCommands.SpeechCommandRecognizer | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(false);
  
  // 1. Keep the callback stable to prevent re-initialization loops
  const onWakeTriggerRef = useRef(onWakeTrigger);
  useEffect(() => {
    onWakeTriggerRef.current = onWakeTrigger;
  }, [onWakeTrigger]);

  // Support both keywords
  const WAKE_WORDS = ["organizer", "organizador"];

  // 2. Load Model Once
  useEffect(() => {
    let mounted = true;
    const loadModel = async () => {
      try {
        await tf.ready();
        const baseUrl = window.location.origin;
        const recognizer = speechCommands.create(
          "BROWSER_FFT", 
          undefined, 
          `${baseUrl}/model/task-organizer-model.json`, 
          `${baseUrl}/model/metadata.json`
        );
        await recognizer.ensureModelLoaded();
        if (mounted) {
            setModel(recognizer);
            setIsModelLoading(false);
        }
      } catch (error) {
        console.error("Model Error:", error);
        if (mounted) setIsModelLoading(false);
      }
    };
    loadModel();
    return () => { mounted = false; };
  }, []);

  // 3. Manage Listening State (Robustly)
  useEffect(() => {
    if (!model || isModelLoading) return;

    // We only listen if enabled AND NOT currently recording
    const shouldListen = isWakeWordEnabled && !isRecording;
    
    const toggleListening = async () => {
        try {
            if (shouldListen) {
                // START LISTENING
                if (!model.isListening()) {
                    try {
                        await model.listen(async (result) => {
                            const scores = result.scores as Float32Array;
                            const maxScore = Math.max(...scores);
                            const maxScoreIndex = scores.indexOf(maxScore);
                            const detectedWord = model.wordLabels()[maxScoreIndex];
                            
                            // Use Ref to call the latest callback
                            if (WAKE_WORDS.includes(detectedWord) && maxScore > 0.92) {
                               console.log("Wake word detected:", detectedWord);
                               onWakeTriggerRef.current();
                            }
                        }, {
                            includeSpectrogram: false,
                            probabilityThreshold: 0.85, 
                            invokeCallbackOnNoiseAndUnknown: true,
                            overlapFactor: 0.5 
                        });
                    } catch (err: any) {
                        // Ignore "Streaming is ongoing" error (it means we are good)
                        if (!err.message?.includes('streaming is ongoing')) {
                           console.error("Start Listening Error:", err);
                        }
                    }
                }
            } else {
                // STOP LISTENING
                if (model.isListening()) {
                    try {
                        await model.stopListening();
                    } catch (err: any) {
                        // CRITICAL FIX: Ignore "no ongoing streaming" error
                        // This happens if the stream cut out before we could stop it.
                        if (!err.message?.includes('no ongoing streaming')) {
                            console.error("Stop Listening Error:", err);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Wake Word Toggle Error:", error);
        }
    };

    toggleListening();

    // Cleanup on unmount only
    return () => {
        if (model && model.isListening()) {
             model.stopListening().catch(() => {});
        }
    };
    // Note: We intentionally exclude 'onWakeTrigger' from deps to avoid restarting listener
  }, [model, isModelLoading, isWakeWordEnabled, isRecording]);

  return {
    isModelLoading,
    isWakeWordEnabled,
    setIsWakeWordEnabled
  };
}