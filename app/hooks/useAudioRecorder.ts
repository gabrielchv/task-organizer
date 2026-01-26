import { useState, useRef, useCallback, useEffect } from "react";
// @ts-ignore
import { createModel } from "vosk-browser";

// Configuration for supported languages
const BUCKET_URL = "https://storage.googleapis.com/task-organizer-assets";

const MODEL_CONFIG: Record<string, { path: string }> = {
  en: {
    path: `${BUCKET_URL}/en/model.tar.gz`,
  },
  pt: {
    path: `${BUCKET_URL}/pt/model.tar.gz`,
  },
};

interface RecorderHookProps {
  onRecordingComplete: (blob: Blob) => void;
  showToast: (msg: string) => void;
  dict: any;
  lang?: string;
}

export function useAudioRecorder({ onRecordingComplete, showToast, dict, lang = "en" }: RecorderHookProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isWakeWordTriggered, setIsWakeWordTriggered] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const isPressingRef = useRef(false); 
  
  // Use a ref for the cleanup function to avoid dependency cycles
  const voskCleanupRef = useRef<(() => void) | null>(null);
  const voskModelRef = useRef<any>(null);
  const voskRecognizerRef = useRef<any>(null);
  const lastWordTimeRef = useRef<number>(0);
  const hasSpokenRef = useRef<boolean>(false);
  const voskTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to stop recording (Stable Reference)
  const stopRecordingLogic = useCallback(() => {
    isPressingRef.current = false;
    
    // Clean up Vosk if exists
    if (voskCleanupRef.current) {
        voskCleanupRef.current();
        voskCleanupRef.current = null;
    }

    // Clear timeout if exists
    if (voskTimeoutRef.current) {
      clearTimeout(voskTimeoutRef.current);
      voskTimeoutRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Helper to detect the best supported audio mimeType for the device
  const getSupportedMimeType = useCallback(() => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/m4a',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    // Fallback: return empty string to let browser choose default
    return '';
  }, []);

  // Helper to start recording (Stable Reference)
  const startRecordingLogic = useCallback(async (useVAD = false) => {
    isPressingRef.current = true;
    startTimeRef.current = Date.now();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (!isPressingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      // Detect the best supported mimeType for this device
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Store the actual mimeType used by the recorder
      const actualMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
      
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const duration = Date.now() - startTimeRef.current;
        
        if (duration < 500) {
          showToast(dict.holdToRecord);
        } else {
          // Use the actual mimeType from the recorder, or fallback to detected type
          const blobType = actualMimeType.split(';')[0]; // Remove codec info if present
          const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
          onRecordingComplete(audioBlob);
        }
        
        setIsRecording(false);
        setIsWakeWordTriggered(false); 
      };
      
      mediaRecorder.start();
      setIsRecording(true);

      if (useVAD) {
          // Initialize Vosk-based word detection
          try {
             const safeLang = lang.startsWith("pt") ? "pt" : "en";
             const config = MODEL_CONFIG[safeLang];
             
             // Reset tracking variables
             lastWordTimeRef.current = Date.now();
             hasSpokenRef.current = false;

             const initializeVosk = async () => {
               try {
                 // Load model if not already loaded
                 if (!voskModelRef.current) {
                   console.log("Loading Vosk model for word detection...");
                   voskModelRef.current = await createModel(config.path);
                 }

                 // Create recognizer without grammar restriction to detect any words
                 const audioContext = new AudioContext({ sampleRate: 48000 });
                 voskRecognizerRef.current = new voskModelRef.current.KaldiRecognizer(48000);

                 // Handle recognition results
                 voskRecognizerRef.current.on("result", (message: any) => {
                   const result = message.result;
                   if (result && result.text && result.text.trim().length > 0) {
                     // Word detected - update last word time
                     lastWordTimeRef.current = Date.now();
                     hasSpokenRef.current = true;
                     console.log("Word detected:", result.text);
                     
                     // Clear existing timeout and set new one
                     if (voskTimeoutRef.current) {
                       clearTimeout(voskTimeoutRef.current);
                     }
                     
                     // Set timeout to stop recording after silence period
                     voskTimeoutRef.current = setTimeout(() => {
                       if (hasSpokenRef.current) {
                         console.log("Silence detected, stopping recording...");
                         stopRecordingLogic();
                       }
                     }, 1500); // 1.5 seconds of silence after last word
                   }
                 });

                 // Handle partial results (interim results)
                 voskRecognizerRef.current.on("partialresult", (message: any) => {
                   const result = message.result;
                   if (result && result.partial && result.partial.trim().length > 0) {
                     // Partial word detected - update last word time
                     lastWordTimeRef.current = Date.now();
                     hasSpokenRef.current = true;
                     
                     // Clear existing timeout and set new one
                     if (voskTimeoutRef.current) {
                       clearTimeout(voskTimeoutRef.current);
                     }
                     
                     // Set timeout to stop recording after silence period
                     voskTimeoutRef.current = setTimeout(() => {
                       if (hasSpokenRef.current) {
                         console.log("Silence detected, stopping recording...");
                         stopRecordingLogic();
                       }
                     }, 1500);
                   }
                 });

                 // Create audio processing pipeline
                 const source = audioContext.createMediaStreamSource(stream);
                 const processor = audioContext.createScriptProcessor(4096, 1, 1);
                 
                 processor.onaudioprocess = (event) => {
                   try {
                     if (voskRecognizerRef.current) {
                       voskRecognizerRef.current.acceptWaveform(event.inputBuffer);
                     }
                   } catch (err) {
                     console.error("Vosk processing error:", err);
                   }
                 };

                 source.connect(processor);
                 processor.connect(audioContext.destination);

                 // Set initial timeout for cases where user doesn't speak at all
                 // This will be cleared and replaced when words are detected
                 voskTimeoutRef.current = setTimeout(() => {
                   if (!hasSpokenRef.current) {
                     console.log("No speech detected, stopping recording...");
                     stopRecordingLogic();
                   }
                 }, 4000); // 4 seconds if no words detected at all

                 voskCleanupRef.current = () => {
                   if (voskTimeoutRef.current) {
                     clearTimeout(voskTimeoutRef.current);
                     voskTimeoutRef.current = null;
                   }
                   if (processor) {
                     processor.disconnect();
                   }
                   audioContext.close().catch(console.error);
                 };
               } catch (err) {
                 console.error("Vosk initialization error:", err);
                 // Fallback: stop recording if Vosk fails
                 stopRecordingLogic();
               }
             };

             initializeVosk();
          } catch (e) {
             console.error("Vosk Error", e);
             // Fallback: stop recording if initialization fails
             stopRecordingLogic();
          }
      }

    } catch (err) { 
      console.error(err);
      showToast("Microphone denied"); 
      setIsRecording(false);
      isPressingRef.current = false;
      setIsWakeWordTriggered(false);
    }
  }, [dict.holdToRecord, onRecordingComplete, showToast, stopRecordingLogic, getSupportedMimeType, lang]);

  // Stable trigger for Wake Word hook
  const triggerWakeWordRecording = useCallback(async () => {
    setIsWakeWordTriggered(true);
    await startRecordingLogic(true);
  }, [startRecordingLogic]);

  return {
    isRecording,
    isWakeWordTriggered,
    startRecordingLogic,
    stopRecordingLogic,
    triggerWakeWordRecording
  };
}