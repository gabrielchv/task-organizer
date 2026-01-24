import { useState, useEffect, useRef } from "react";
import { usePorcupine } from "@picovoice/porcupine-react";

// Configuration for the wake word
const WAKE_WORD_CONFIG = {
  label: "organizer",
  publicPath: "/model/organizer.ppn", // Make sure this matches your file name in public/model/
};

const MODEL_PARAMS = {
  publicPath: "/model/porcupine_params.pv",
};

export function useWakeWord(isRecording: boolean, onWakeTrigger: () => void) {
  // We keep the exact same API state variables as your previous version
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(false);
  
  // Use a ref to ensure we always call the latest version of the callback
  const onWakeTriggerRef = useRef(onWakeTrigger);
  useEffect(() => {
    onWakeTriggerRef.current = onWakeTrigger;
  }, [onWakeTrigger]);

  const {
    keywordDetection,
    isLoaded,
    isListening,
    init,
    start,
    stop,
    release,
    error,
  } = usePorcupine();

  // 1. Initialize Porcupine on mount
  useEffect(() => {
    init(
      "SM2k7DYZr9RIZk3bBsTAdIocmctOFfopluquGnmcMJA5IO88w+txqg==",
      [WAKE_WORD_CONFIG],
      MODEL_PARAMS
    );

    // Cleanup when component unmounts
    return () => {
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Handle Wake Word Detection
  useEffect(() => {
    if (keywordDetection !== null && keywordDetection.label === "organizer") {
      console.log("Wake word detected:", keywordDetection.label);
      onWakeTriggerRef.current();
    }
  }, [keywordDetection]);

  // 3. Manage Listening State
  // We sync the Porcupine state with your app's requirements (enabled + not recording)
  useEffect(() => {
    // Wait until model is loaded
    if (!isLoaded) return;

    // Logic: Only listen if user enabled it AND we are not currently recording audio
    const shouldListen = isWakeWordEnabled && !isRecording;

    const manageState = async () => {
      try {
        if (shouldListen && !isListening) {
          await start();
        } else if (!shouldListen && isListening) {
          await stop();
        }
      } catch (err) {
        console.error("Porcupine toggle error:", err);
      }
    };

    manageState();
  }, [isWakeWordEnabled, isRecording, isLoaded, isListening, start, stop]);

  // Log errors if any occur during initialization or processing
  useEffect(() => {
    if (error) {
      console.error("Porcupine Error:", error);
    }
  }, [error]);

  return {
    isModelLoading: !isLoaded, // Map isLoaded to isModelLoading for compatibility
    isWakeWordEnabled,
    setIsWakeWordEnabled,
  };
}