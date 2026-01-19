"use client";

import { useEffect, useState, useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import * as speechCommands from "@tensorflow-models/speech-commands";

// Register backends
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";

export default function Trainer() {
  // State
  const [baseRecognizer, setBaseRecognizer] = useState<speechCommands.SpeechCommandRecognizer | null>(null);
  const [transferRecognizer, setTransferRecognizer] = useState<speechCommands.TransferSpeechCommandRecognizer | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [counts, setCounts] = useState({ organizer: 0, organizador: 0, _background_noise_: 0 });
  const [isTraining, setIsTraining] = useState(false);
  const [trainLogs, setTrainLogs] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState<string | null>(null);

  // Labels to train
  const LABELS = ["organizer", "organizador"];

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      await tf.ready();
      
      // 1. Load the base model (BROWSER_FFT)
      const recognizer = speechCommands.create("BROWSER_FFT");
      await recognizer.ensureModelLoaded();
      setBaseRecognizer(recognizer);

      // 2. Create a transfer recognizer (this is what we will train)
      const transfer = recognizer.createTransfer("custom-task-organizer");
      setTransferRecognizer(transfer);
      
      setStatus("Ready to record");
    } catch (err) {
      console.error(err);
      setStatus("Error loading TFJS");
    }
  };

  const collectExample = async (label: string) => {
    if (!transferRecognizer) return;

    setIsRecording(label);
    
    // collectExample grabs the *current* spectrogram from the mic
    // We usually want to call this WHILE the user is speaking or immediately after
    // The library handles the audio stream internally
    try {
      await transferRecognizer.collectExample(label);
      
      // Update counts
      const exampleCounts = transferRecognizer.countExamples();
      // @ts-ignore - The types for countExamples are sometimes generic, strictly mapping to our known labels
      setCounts({ ...counts, ...exampleCounts });
    } catch (e) {
      console.error(e);
    }
    
    // Small delay for UI feedback
    setTimeout(() => setIsRecording(null), 200);
  };

  const trainModel = async () => {
    if (!transferRecognizer) return;
    
    // Check if we have enough data
    if (counts.organizer < 10 || counts.organizador < 10 || counts._background_noise_ < 5) {
        alert("Please record at least 10 examples for each word and 5 for background noise.");
        return;
    }

    setIsTraining(true);
    setStatus("Training...");
    setTrainLogs([]);

    try {
      await transferRecognizer.train({
        epochs: 30, // Number of training loops
        callback: {
          onEpochEnd: async (epoch, logs) => {
             setTrainLogs(prev => [...prev, `Epoch ${epoch}: loss=${logs?.loss.toFixed(4)} accuracy=${logs?.acc.toFixed(4)}`]);
          }
        }
      });
      setStatus("Training Complete! Ready to Save.");
    } catch (err) {
      console.error(err);
      setStatus("Training Failed");
    } finally {
      setIsTraining(false);
    }
  };

  const saveModel = async () => {
    if (!transferRecognizer) return;
    // 'downloads://' triggers the browser to download model.json and metadata.json
    await transferRecognizer.save('downloads://task-organizer-model');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <header className="mb-8 border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-800">Keyword Trainer</h1>
          <p className="text-sm text-gray-500 mt-1">Status: <span className="font-mono text-blue-600">{status}</span></p>
        </header>

        {/* --- RECORDING SECTION --- */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            1. Collect Examples
            <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-1 rounded">Recommended: 30+ each</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Custom Words */}
            {LABELS.map(label => (
                <div key={label} className="flex flex-col gap-2">
                    <button
                        onMouseDown={() => collectExample(label)}
                        className={`p-6 rounded-xl border-2 transition-all active:scale-95 text-center flex flex-col items-center gap-2
                           ${isRecording === label 
                               ? 'border-blue-500 bg-blue-50 text-blue-700' 
                               : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                    >
                        <span className="text-2xl font-bold capitalize">{label}</span>
                        <span className="text-xs uppercase tracking-wider font-bold text-gray-400">Click repeatedly while saying word</span>
                    </button>
                    <div className="text-center text-sm font-mono text-gray-500">
                        Count: {counts[label as keyof typeof counts] || 0}
                    </div>
                </div>
            ))}

            {/* Background Noise */}
            <div className="flex flex-col gap-2">
                <button
                    onMouseDown={() => collectExample('_background_noise_')}
                    className={`p-6 rounded-xl border-2 transition-all active:scale-95 text-center flex flex-col items-center gap-2
                       ${isRecording === '_background_noise_' 
                           ? 'border-gray-500 bg-gray-100' 
                           : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                >
                    <span className="text-xl font-bold text-gray-600">Background Noise</span>
                    <span className="text-xs uppercase tracking-wider font-bold text-gray-400">Click periodically during silence</span>
                </button>
                <div className="text-center text-sm font-mono text-gray-500">
                    Count: {counts._background_noise_}
                </div>
            </div>
          </div>
        </section>

        {/* --- TRAINING SECTION --- */}
        <section className="mb-8 border-t pt-8">
          <h2 className="text-lg font-semibold mb-4">2. Train Model</h2>
          <div className="flex gap-4 items-start">
             <button
                onClick={trainModel}
                disabled={isTraining || !transferRecognizer}
                className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                {isTraining ? "Training..." : "Train Model"}
             </button>
             
             {/* Simple Logs */}
             <div className="flex-1 bg-gray-900 text-green-400 text-xs font-mono p-4 rounded-lg h-32 overflow-y-auto">
                 {trainLogs.length === 0 ? "// Waiting to train..." : trainLogs.map((l, i) => <div key={i}>{l}</div>)}
             </div>
          </div>
        </section>

        {/* --- SAVING SECTION --- */}
        <section className="border-t pt-8">
            <h2 className="text-lg font-semibold mb-4">3. Download & Install</h2>
            <p className="text-sm text-gray-600 mb-4">
                This will download two files: <code>task-organizer-model.json</code> and <code>task-organizer-model.weights.bin</code>.
            </p>
            <button
                onClick={saveModel}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 w-full flex justify-center items-center gap-2"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Download Files
            </button>
        </section>

      </div>
    </div>
  );
}