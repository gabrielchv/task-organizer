"use client";

import { useEffect, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as speechCommands from "@tensorflow-models/speech-commands";

import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";

interface SpeechRecognizer extends speechCommands.SpeechCommandRecognizer {
    listen: (
        callback: (result: speechCommands.SpeechCommandRecognizerResult) => Promise<void>,
        options?: speechCommands.StreamingRecognitionOptions
    ) => Promise<void>;
    stopListening: () => Promise<void>;
}

export default function WakeWordTest() {
  const [model, setModel] = useState<SpeechRecognizer | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [probability, setProbability] = useState(0);
  const [status, setStatus] = useState("Initializing...");

  // Match this to one of the words in your metadata.json
  const WAKE_WORD = "organizer"; 

  useEffect(() => {
    loadModel();
  }, []);

  const loadModel = async () => {
    try {
      setStatus("Setting up backend...");
      await tf.ready(); 
      
      setStatus("Loading CUSTOM model...");
      
      const baseUrl = window.location.origin;

      // CORRECTED CALL:
      // Arg 3: The model.json (which internally finds weights.bin)
      // Arg 4: The metadata.json (which we just created manually)
      const recognizer = speechCommands.create(
        "BROWSER_FFT", 
        undefined, 
        `${baseUrl}/model/task-organizer-model.json`, 
        `${baseUrl}/model/metadata.json`
      ) as SpeechRecognizer;
      
      await recognizer.ensureModelLoaded();
      
      const loadedLabels = recognizer.wordLabels();
      console.log("Labels loaded:", loadedLabels);
      
      setLabels(loadedLabels);
      setModel(recognizer);
      setStatus("Custom Model Loaded!");
    } catch (error) {
      console.error("Error loading model:", error);
      setStatus("Error: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const startListening = async () => {
    if (!model) return;

    setIsListening(true);
    setStatus("Listening...");

    await model.listen(async (result) => {
      const scores = result.scores as Float32Array;
      const maxScoreIndex = scores.indexOf(Math.max(...scores));
      const detectedWord = model.wordLabels()[maxScoreIndex];
      const detectedProb = scores[maxScoreIndex];

      setAction(detectedWord);
      setProbability(detectedProb);

      if (detectedWord === WAKE_WORD && detectedProb > 0.85) {
        console.log("Wake word detected!");
      }
    }, {
      includeSpectrogram: false,
      probabilityThreshold: 0.75,
      invokeCallbackOnNoiseAndUnknown: true,
      overlapFactor: 0.5 
    });
  };

  const stopListening = async () => {
    if (!model) return;
    await model.stopListening();
    setIsListening(false);
    setStatus("Stopped");
    setAction(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center gap-6">
      <h1 className="text-2xl font-bold text-gray-800">Wake Word Test</h1>
      
      <div className={`px-4 py-2 rounded-full text-sm font-bold ${
        status.includes("Listening") ? "bg-green-100 text-green-700 animate-pulse" : 
        status.includes("Error") ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-700"
      }`}>
        {status}
      </div>

      <div className="flex gap-4">
        <button
          onClick={startListening}
          disabled={!model || isListening}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          Start Listening
        </button>
        <button
          onClick={stopListening}
          disabled={!isListening}
          className="bg-red-500 text-white px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600 transition-colors"
        >
          Stop
        </button>
      </div>

      <div className="w-full max-w-md bg-white p-6 rounded-xl shadow-lg text-center">
        <p className="text-gray-500 text-sm mb-2">Detected Word</p>
        <div className={`text-5xl font-black transition-all duration-200 ${
          action === WAKE_WORD ? "text-green-500 scale-110" : "text-gray-800"
        }`}>
          {action || "..."}
        </div>
        <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
                className="h-full bg-blue-500 transition-all duration-200"
                style={{ width: `${probability * 100}%` }}
            />
        </div>
        <p className="text-xs text-gray-400 mt-1">Confidence: {(probability * 100).toFixed(1)}%</p>
      </div>

      <div className="text-center max-w-lg">
        <h3 className="font-bold text-gray-700 mb-2">Available Keywords:</h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          {labels.map(label => (
             <span key={label} className={`inline-block px-2 py-1 m-1 rounded border ${
                 label === WAKE_WORD ? "bg-green-50 border-green-200 font-bold text-green-700" : "bg-white border-gray-200"
             }`}>
                 {label}
             </span>
          ))}
        </p>
      </div>
    </div>
  );
}