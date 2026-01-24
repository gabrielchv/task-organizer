import { useState, useEffect, useRef } from "react";
// @ts-ignore
import { createModel } from "vosk-browser";

export function useWakeWord(isRecording: boolean, onWakeTrigger: () => void) {
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  
  const recognizerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  const onWakeTriggerRef = useRef(onWakeTrigger);
  useEffect(() => {
    onWakeTriggerRef.current = onWakeTrigger;
  }, [onWakeTrigger]);

  useEffect(() => {
    const cleanup = () => {
      if (recognizerRef.current) {
        try {
          recognizerRef.current.remove();
        } catch (e) { /* ignore cleanup errors */ }
        recognizerRef.current = null;
      }
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

    if (!isWakeWordEnabled || isRecording) {
      cleanup();
      return;
    }

    let mounted = true;

    const initVosk = async () => {
      try {
        setIsModelLoading(true);

        // 1. Load the model
        // Ensure this path matches your manually converted file
        const model = await createModel("/model/model.tar.gz");
        
        // 2. Create Recognizer attached to the model
        // We pass the grammar here to force it to only listen for "organizer"
        const recognizer = new model.KaldiRecognizer(48000, '["organizer", "[unk]"]');

        recognizer.on("result", (message: any) => {
          const result = message.result;
          if (result && result.text && result.text.includes("organizer")) {
            console.log("Wake word detected:", result.text);
            onWakeTriggerRef.current();
          }
        });

        // 3. Start Audio Stream
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000
          }
        });
        streamRef.current = stream;

        // 4. Create Audio Context & Processor
        const audioContext = new AudioContext({ sampleRate: 48000 });
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);

        // Use ScriptProcessorNode (bufferSize, inputChannels, outputChannels)
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        // Feed audio data to Vosk
        processor.onaudioprocess = (event) => {
          try {
            if (recognizerRef.current) {
              recognizerRef.current.acceptWaveform(event.inputBuffer);
            }
          } catch (err) {
            console.error("Audio process error:", err);
          }
        };
        
        source.connect(processor);
        processor.connect(audioContext.destination);

        recognizerRef.current = recognizer;
        
        if (mounted) setIsModelLoading(false);

      } catch (error) {
        console.error("Vosk Init Error:", error);
        if (mounted) {
           setIsWakeWordEnabled(false); 
           setIsModelLoading(false);
           cleanup();
        }
      }
    };

    initVosk();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [isWakeWordEnabled, isRecording]);

  return {
    isModelLoading,
    isWakeWordEnabled,
    setIsWakeWordEnabled
  };
}