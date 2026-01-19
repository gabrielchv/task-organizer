"use client";

import { useEffect, useState, useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import * as speechCommands from "@tensorflow-models/speech-commands";

import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";

// --- TIPOS ---
type TrainingStep = 'init' | 'collecting' | 'training' | 'ready';

export default function WakeWordTrainer() {
  // --- ESTADO ---
  const [step, setStep] = useState<TrainingStep>('init');
  const [status, setStatus] = useState("Inicializando TensorFlow...");
  
  // Referências do Modelo
  const recognizerRef = useRef<speechCommands.SpeechCommandRecognizer | null>(null);
  const transferRecognizerRef = useRef<speechCommands.TransferSpeechCommandRecognizer | null>(null);
  
  // Contadores de Amostras
  const [counts, setCounts] = useState({
      noise: 0,
      irrelevant: 0,
      organizer: 0,
      organizador: 0
  });
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  
  // Treinamento
  const [epochLogs, setEpochLogs] = useState<{loss: number, acc: number}[]>([]);
  
  // Teste
  const [isListening, setIsListening] = useState(false);
  const [detectedWord, setDetectedWord] = useState<string | null>(null);
  const [probability, setProbability] = useState(0);

  // --- CONFIGURAÇÃO DAS CLASSES ---
  const NOISE_LABEL = "_background_noise_";
  const IRRELEVANT_LABEL = "_irrelevant_";
  const WORD_1 = "organizer";
  const WORD_2 = "organizador";

  // Botões de Controle
  const CONTROLS = [
    { 
        label: NOISE_LABEL, 
        name: "Ruído de Fundo", 
        desc: "Silêncio, ventilador, digitar, cliques",
        count: counts.noise, 
        color: "bg-gray-500",
        min: 30
    },
    { 
        label: IRRELEVANT_LABEL, 
        name: "Fala Irrelevante", 
        desc: "Diga: 'Orgânico', 'Obrigado', 'Tarefa', 'Lista'...",
        count: counts.irrelevant, 
        color: "bg-yellow-600",
        min: 40
    },
    { 
        label: WORD_1, 
        name: '"Organizer"', 
        desc: "Inglês/Padrão. Varie a entonação.",
        count: counts.organizer, 
        color: "bg-blue-600",
        min: 40
    },
    { 
        label: WORD_2, 
        name: '"Organizador"', 
        desc: "Português. Varie a distância do mic.",
        count: counts.organizador, 
        color: "bg-indigo-600",
        min: 40
    }
  ];

  // --- 1. INICIALIZAÇÃO ---
  useEffect(() => {
    loadBaseModel();
    return () => { stopListening(); }; 
  }, []);

  const loadBaseModel = async () => {
    try {
      await tf.ready();
      // Carrega o modelo base do Google (navegador)
      const baseRecognizer = speechCommands.create("BROWSER_FFT");
      await baseRecognizer.ensureModelLoaded();
      
      // Cria o modelo de transferência vazio
      const transfer = baseRecognizer.createTransfer("task-organizer-v2");
      
      recognizerRef.current = baseRecognizer;
      transferRecognizerRef.current = transfer;
      
      setStep('collecting');
      setStatus("Pronto. Colete amostras para TODAS as 4 categorias.");
    } catch (err) {
      console.error(err);
      setStatus("Erro ao carregar TensorFlow. Recarregue a página.");
    }
  };

  // --- 2. COLETA DE DADOS ---
  const startCollecting = async (label: string) => {
    if (!transferRecognizerRef.current) return;
    if (isListening) await stopListening();
    
    setActiveLabel(label);
    setStatus(`Gravando: ${label}...`);

    // Coleta 1 exemplo (~1 segundo de áudio)
    await transferRecognizerRef.current.collectExample(label);
    
    // Atualiza contadores
    const countMap = transferRecognizerRef.current.countExamples();
    
    // Mapeia os dados do modelo para o nosso estado
    // O TensorFlow pode retornar undefined se não tiver amostras ainda
    setCounts({
        noise: countMap[NOISE_LABEL] || 0,
        irrelevant: countMap[IRRELEVANT_LABEL] || 0,
        organizer: countMap[WORD_1] || 0,
        organizador: countMap[WORD_2] || 0
    });
    
    setActiveLabel(null);
    setStatus("Amostra gravada.");
  };

  // --- 3. TREINAMENTO ---
  const trainModel = async () => {
    if (!transferRecognizerRef.current) return;
    
    // Validação Rígida
    const missing = CONTROLS.filter(c => c.count < 10); // Mínimo técnico baixo, mas recomendado é o do botão
    if (missing.length > 0) {
        setStatus(`Erro: Colete pelo menos 10 amostras para: ${missing.map(c => c.name).join(", ")}`);
        return;
    }

    setStep('training');
    setStatus("Treinando a Rede Neural...");
    setEpochLogs([]);

    try {
        await transferRecognizerRef.current.train({
            epochs: 35, // Um pouco mais de épocas para 4 classes
            callback: {
                onEpochEnd: async (epoch, logs) => {
                    setEpochLogs(prev => [...prev, { 
                        loss: logs?.loss || 0, 
                        acc: logs?.acc || 0 
                    }]);
                }
            }
        });
        setStep('ready');
        setStatus("Treinamento Concluído! Teste abaixo.");
    } catch (err) {
        console.error(err);
        setStatus("Falha no treinamento.");
        setStep('collecting');
    }
  };

  // --- 4. TESTE ---
  const startListening = async () => {
    if (!transferRecognizerRef.current) return;
    
    setIsListening(true);
    setStatus("Ouvindo...");
    
    // @ts-expect-error
    await transferRecognizerRef.current.listen(result => {
        const scores = result.scores as Float32Array;
        const words = transferRecognizerRef.current!.wordLabels();
        
        // Pega o maior score
        const maxIndex = scores.indexOf(Math.max(...scores));
        const label = words[maxIndex];
        const prob = scores[maxIndex];
        
        setDetectedWord(label);
        setProbability(prob);

        // Lógica de Ativação (Aceita ambos os comandos)
        if ((label === WORD_1 || label === WORD_2) && prob > 0.92) {
            console.log("WAKE WORD DETECTADA:", label);
        }
    }, {
        probabilityThreshold: 0.80, // Só notifica se tiver certeza razoável
        overlapFactor: 0.5 // Rapidez de resposta
    });
  };

  const stopListening = async () => {
    if (transferRecognizerRef.current && transferRecognizerRef.current.isListening()) {
        await transferRecognizerRef.current.stopListening();
    }
    setIsListening(false);
    setStatus("Parado.");
    setDetectedWord(null);
    setProbability(0);
  };

  // --- 5. EXPORTAR ---
  const downloadModel = async () => {
    if (!transferRecognizerRef.current) return;
    
    // Salva o modelo binário e JSON
    await transferRecognizerRef.current.save('downloads://task-organizer-model');
    
    // Salva o metadata manual para garantir compatibilidade
    const metadata = {
        words: transferRecognizerRef.current.wordLabels(),
        // @ts-expect-error
        frameSize: recognizerRef.current?.parameters.sampleRate || 232 
    };
    
    const blob = new Blob([JSON.stringify(metadata)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = "metadata.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setStatus("Arquivos baixados! Mova para public/model/");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans flex flex-col items-center gap-6">
      
      {/* CABEÇALHO */}
      <div className="text-center space-y-2 max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-800">Treinador de Wake Word Robusto</h1>
        <p className="text-sm text-gray-500">
          Para zero falso positivo, siga as instruções de cada cartão. 
          O modelo aprenderá a ignorar barulhos e palavras parecidas.
        </p>
        <div className={`inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
            status.includes("Erro") ? "bg-red-50 text-red-600 border-red-200" : "bg-white text-blue-600 border-blue-100"
        }`}>
            {status}
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-8 w-full max-w-6xl">
        
        {/* COLUNA 1: COLETA E TREINO */}
        <div className="space-y-6">
            <div className={`bg-white p-6 rounded-2xl shadow-sm border-2 transition-colors ${step === 'collecting' ? 'border-blue-500 ring-4 ring-blue-50' : 'border-transparent'}`}>
                <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    Coletar Amostras
                </h2>
                
                <div className="grid grid-cols-2 gap-3">
                    {CONTROLS.map(ctrl => {
                        const isComplete = ctrl.count >= ctrl.min;
                        return (
                            <div key={ctrl.label} className="flex flex-col gap-1">
                                <button
                                    onMouseDown={() => startCollecting(ctrl.label)}
                                    disabled={step !== 'collecting'}
                                    className={`relative h-28 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden
                                        ${ctrl.color} ${activeLabel === ctrl.label ? 'scale-95 ring-4 ring-offset-1 ring-blue-300' : 'hover:brightness-110'}
                                    `}
                                >
                                    <span className="text-3xl font-black">{ctrl.count}</span>
                                    <span className="text-[10px] uppercase tracking-wider font-bold opacity-90">{ctrl.name}</span>
                                    
                                    {/* Barra de Progresso Visual */}
                                    <div className="absolute bottom-0 left-0 h-1 bg-black/20 w-full">
                                        <div 
                                            className={`h-full ${isComplete ? 'bg-green-400' : 'bg-white/50'}`} 
                                            style={{ width: `${Math.min(100, (ctrl.count / ctrl.min) * 100)}%` }} 
                                        />
                                    </div>
                                    {isComplete && (
                                        <div className="absolute top-2 right-2 text-green-300">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                        </div>
                                    )}
                                </button>
                                <p className="text-[10px] text-center text-gray-500 leading-tight px-1 min-h-[2.5em]">
                                    {ctrl.desc}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            <button
                onClick={trainModel}
                disabled={step !== 'collecting' || CONTROLS.some(c => c.count < 10)} 
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 group"
            >
                {step === 'training' ? (
                   <>
                     <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                     Treinando...
                   </>
                ) : (
                    <>
                        <span>Treinar Modelo</span>
                        {!CONTROLS.some(c => c.count < 10) && <span className="opacity-0 group-hover:opacity-100 transition-opacity">🚀</span>}
                    </>
                )}
            </button>
            
            {epochLogs.length > 0 && (
                 <div className="h-32 bg-gray-900 rounded-xl p-4 overflow-y-auto font-mono text-xs text-green-400 shadow-inner">
                    <div className="mb-2 text-gray-500 border-b border-gray-800 pb-1">Logs de Treinamento:</div>
                    {epochLogs.map((log, i) => (
                        <div key={i} className="flex justify-between">
                            <span>Época {String(i+1).padStart(2, '0')}</span>
                            <span>Perda: {log.loss.toFixed(4)}</span>
                            <span>Acurácia: {(log.acc*100).toFixed(1)}%</span>
                        </div>
                    ))}
                 </div>
            )}
        </div>

        {/* COLUNA 2: TESTE E EXPORTAÇÃO */}
        <div className="space-y-6">
            <div className={`bg-white p-6 rounded-2xl shadow-sm border-2 transition-colors ${step === 'ready' ? 'border-green-500 ring-4 ring-green-50' : 'border-transparent'}`}>
                <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    Testar ao Vivo
                </h2>

                {/* Display do Teste */}
                <div className="bg-gray-50 rounded-xl p-8 text-center mb-6 relative overflow-hidden border border-gray-100">
                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-3 tracking-widest">O Modelo ouviu:</p>
                    
                    <div className={`text-4xl sm:text-5xl font-black transition-all duration-200 ${
                        (detectedWord === WORD_1 || detectedWord === WORD_2) ? "text-green-500 scale-105" : 
                        detectedWord === IRRELEVANT_LABEL ? "text-yellow-500 scale-95" :
                        detectedWord === NOISE_LABEL ? "text-gray-300 scale-90" :
                        "text-gray-300"
                    }`}>
                        {detectedWord === IRRELEVANT_LABEL ? "Ignorado" : 
                         detectedWord === NOISE_LABEL ? "..." :
                         (detectedWord || "...")}
                    </div>
                    
                    {detectedWord && detectedWord !== NOISE_LABEL && (
                        <div className="mt-2 text-xs font-mono text-gray-400 bg-gray-200 inline-block px-2 py-0.5 rounded">
                            {detectedWord}
                        </div>
                    )}
                    
                    <div className="mt-6 flex justify-center gap-1 h-1.5 w-full max-w-[200px] mx-auto bg-gray-200 rounded-full overflow-hidden">
                        <div 
                            className={`transition-all duration-150 ${
                                (detectedWord === WORD_1 || detectedWord === WORD_2) ? 'bg-green-500' : 'bg-gray-400'
                            }`} 
                            style={{ width: `${probability * 100}%` }} 
                        />
                    </div>
                    <p className="text-xs text-gray-400 mt-2 font-mono">Confiança: {(probability * 100).toFixed(0)}%</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={startListening}
                        disabled={step !== 'ready' || isListening}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all active:scale-95"
                    >
                        Iniciar Teste
                    </button>
                    <button
                        onClick={stopListening}
                        disabled={!isListening}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all active:scale-95"
                    >
                        Parar
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                 <h2 className="text-lg font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                    Download
                </h2>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                    Se o teste foi bem sucedido (verde para os comandos, amarelo/cinza para o resto), baixe os arquivos.
                </p>
                <button
                    onClick={downloadModel}
                    disabled={step !== 'ready'}
                    className="w-full border-2 border-gray-200 hover:border-blue-500 hover:text-blue-600 text-gray-600 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Baixar (Model + Weights + Metadata)
                </button>
            </div>
        </div>

      </div>
    </div>
  );
}