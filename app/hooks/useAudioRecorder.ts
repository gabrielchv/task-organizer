import { useState, useRef, useCallback, useEffect } from "react";

interface RecorderHookProps {
  onRecordingComplete: (blob: Blob) => void;
  showToast: (msg: string) => void;
  dict: any;
}

export function useAudioRecorder({ onRecordingComplete, showToast, dict }: RecorderHookProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isWakeWordTriggered, setIsWakeWordTriggered] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const isPressingRef = useRef(false); 
  
  // Use a ref for the cleanup function to avoid dependency cycles
  const vadCleanupRef = useRef<(() => void) | null>(null);

  // Helper to stop recording (Stable Reference)
  const stopRecordingLogic = useCallback(() => {
    isPressingRef.current = false;
    
    // Clean up VAD if exists
    if (vadCleanupRef.current) {
        vadCleanupRef.current();
        vadCleanupRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
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

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const duration = Date.now() - startTimeRef.current;
        
        if (duration < 500) {
          showToast(dict.holdToRecord);
        } else {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          onRecordingComplete(audioBlob);
        }
        
        setIsRecording(false);
        setIsWakeWordTriggered(false); 
      };
      
      mediaRecorder.start();
      setIsRecording(true);

      if (useVAD) {
          // Initialize simple VAD logic
          try {
             const audioContext = new AudioContext();
             const source = audioContext.createMediaStreamSource(stream);
             const analyser = audioContext.createAnalyser();
             analyser.fftSize = 512;
             source.connect(analyser);
             const dataArray = new Uint8Array(analyser.frequencyBinCount);
             
             let silenceStart = Date.now();
             let hasSpoken = false;
             let animationFrameId: number;

             const checkAudio = () => {
                analyser.getByteFrequencyData(dataArray);
                const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
                
                if (volume > 30) {
                    silenceStart = Date.now();
                    hasSpoken = true;
                }
                
                const timeSinceSilence = Date.now() - silenceStart;

                // Stop conditions
                if ((hasSpoken && timeSinceSilence > 1500) || (!hasSpoken && timeSinceSilence > 4000)) {
                    stopRecordingLogic(); // Call the stable stop function
                    return;
                }
                animationFrameId = requestAnimationFrame(checkAudio);
             };
             checkAudio();

             vadCleanupRef.current = () => {
                 cancelAnimationFrame(animationFrameId);
                 audioContext.close().catch(console.error);
             };
          } catch (e) {
             console.error("VAD Error", e);
          }
      }

    } catch (err) { 
      console.error(err);
      showToast("Microphone denied"); 
      setIsRecording(false);
      isPressingRef.current = false;
      setIsWakeWordTriggered(false);
    }
  }, [dict.holdToRecord, onRecordingComplete, showToast, stopRecordingLogic]);

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