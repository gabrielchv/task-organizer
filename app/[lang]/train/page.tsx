"use client";

import { useEffect, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as speechCommands from "@tensorflow-models/speech-commands";

import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";

export default function Trainer() {
  const [baseRecognizer, setBaseRecognizer] = useState<speechCommands.SpeechCommandRecognizer | null>(null);
  const [transferRecognizer, setTransferRecognizer] = useState<speechCommands.TransferSpeechCommandRecognizer | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [counts, setCounts] = useState({ start: 0, _background_noise_: 0 });
  const [isTraining, setIsTraining] = useState(false);
  const [trainLogs, setTrainLogs] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState<string | null>(null);

  // We now only have ONE active class plus background noise
  const WAKE_WORD_LABEL = "start";

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      await tf.ready();
      const recognizer = speechCommands.create("BROWSER_FFT");
      await recognizer.ensureModelLoaded();
      setBaseRecognizer(recognizer);

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
    try {
      await transferRecognizer.collectExample(label);
      const exampleCounts = transferRecognizer.countExamples();
      // @ts-ignore
      setCounts({ ...counts, ...exampleCounts });
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => setIsRecording(null), 200);
  };

  const trainModel = async () => {
    if (!transferRecognizer) return;
    
    // Validate counts
    if (counts.start < 40) {
        alert("Please record at least 40 examples for the Wake Word (mix English & Portuguese).");
        return;
    }
    if (counts._background_noise_ < 40) {
        alert("Please record at least 40 examples of background noise (Silence + Fan + Random Speech).");
        return;
    }

    setIsTraining(true);
    setStatus("Training...");
    setTrainLogs([]);

    try {
      await transferRecognizer.train({
        epochs: 50, // Increased epochs for better convergence
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
    await transferRecognizer.save('downloads://task-organizer-model');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <header className="mb-8 border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-800">Wake Word Trainer</h1>
          <p className="text-sm text-gray-500 mt-1">Status: <span className="font-mono text-blue-600">{status}</span></p>
        </header>

        {/* --- RECORDING SECTION --- */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">1. Collect Data</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* WAKE WORD BUTTON */}
            <div className="flex flex-col gap-2">
                <button
                    onMouseDown={() => collectExample(WAKE_WORD_LABEL)}
                    className={`p-8 rounded-xl border-4 transition-all active:scale-95 text-center flex flex-col items-center gap-2 shadow-sm
                       ${isRecording === WAKE_WORD_LABEL
                           ? 'border-blue-500 bg-blue-50 text-blue-700' 
                           : 'border-blue-100 bg-white hover:border-blue-300'}`}
                >
                    <span className="text-3xl font-black text-blue-900">WAKE WORD</span>
                    <span className="text-xs uppercase tracking-wider font-bold text-blue-400">
                        Say "Organizer" OR "Organizador"
                    </span>
                </button>
                <div className="text-center text-sm text-gray-600 bg-gray-100 p-2 rounded-lg">
                    Count: <strong className="text-lg">{counts.start}</strong> / 40+
                    <p className="text-xs text-gray-400 mt-1">Mix 50% English / 50% Portuguese</p>
                </div>
            </div>

            {/* NOISE BUTTON */}
            <div className="flex flex-col gap-2">
                <button
                    onMouseDown={() => collectExample('_background_noise_')}
                    className={`p-8 rounded-xl border-4 transition-all active:scale-95 text-center flex flex-col items-center gap-2 shadow-sm
                       ${isRecording === '_background_noise_' 
                           ? 'border-red-500 bg-red-50 text-red-700' 
                           : 'border-gray-100 bg-white hover:border-gray-300'}`}
                >
                    <span className="text-3xl font-black text-gray-700">NOISE / OTHER</span>
                    <span className="text-xs uppercase tracking-wider font-bold text-gray-400">
                        Silence • Fan • Random Talk
                    </span>
                </button>
                <div className="text-center text-sm text-gray-600 bg-gray-100 p-2 rounded-lg">
                    Count: <strong className="text-lg">{counts._background_noise_}</strong> / 40+
                    <p className="text-xs text-gray-400 mt-1">Critical: Include "Not Organizer" speech</p>
                </div>
            </div>

          </div>
        </section>

        {/* --- TRAINING SECTION --- */}
        <section className="mb-8 border-t pt-8">
          <h2 className="text-lg font-semibold mb-4">2. Train Model</h2>
          <div className="flex gap-4 items-start h-48">
             <div className="flex flex-col gap-2">
                <button
                    onClick={trainModel}
                    disabled={isTraining || !transferRecognizer}
                    className="bg-black text-white px-8 py-4 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                >
                    {isTraining ? "Training..." : "Train Now"}
                </button>
             </div>
             
             <div className="flex-1 bg-gray-900 text-green-400 text-xs font-mono p-4 rounded-lg h-full overflow-y-auto shadow-inner border border-gray-700">
                 {trainLogs.length === 0 ? "// Waiting to train..." : trainLogs.map((l, i) => <div key={i}>{l}</div>)}
             </div>
          </div>
        </section>

        {/* --- SAVING SECTION --- */}
        <section className="border-t pt-8">
            <h2 className="text-lg font-semibold mb-4">3. Download</h2>
            <button
                onClick={saveModel}
                className="bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 w-full flex justify-center items-center gap-2 font-bold shadow-lg shadow-blue-200"
            >
                Download New Model
            </button>
        </section>

      </div>
    </div>
  );
}