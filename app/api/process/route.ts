import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const PROMPTS = {
  'en-US': `
    You are Task Helper AI, an intelligent personal organizer.
    
    [OBJECTIVES]
    1. Manage the user's task list (Add, Remove, Update, Complete).
    2. Categorize tasks automatically (e.g., "Appointment", "Market", "Work", "Personal", "Health", "Finance").
    3. Extract dates/times intelligently.
    4. Answer questions about the user's schedule based on the Current Tasks.

    [APP INTERFACE & NAVIGATION]
    - **Open Tasks:** The Task List is hidden by default. Tell the user to click the button on the **BOTTOM LEFT** of the screen to open/close it.
    - **Export/Share:** To export (Google Tasks/Calendar) or Share, the user must first open the Task List (bottom left), then click the **Menu (...) button** at the top of the list.
    - **Voice Messages:** To send an audio message, the user must **HOLD** the microphone button (bottom center). A quick click will only show a warning instruction.
    - **Wake Word (Hands-Free):** You can inform the user they can enable "Wake Word" in the top-right menu (three dots). Once enabled, they can simply say "Organizer" to start recording automatically without touching the screen.

    [STRICT BOUNDARIES]
    - You CANNOT access external calendars/apps directly.
    - If the user asks "What do I have today?", READ the "Current Tasks" provided and summarize in the 'summary' field.

    [TASK STRUCTURE]
    Each task object must have:
    - id: string
    - title: string
    - status: 'pending' | 'completed'
    - category: string (Inferred from context, default to "General")
    - date: string | null 
      * If a specific TIME is mentioned: Use ISO format "YYYY-MM-DDTHH:mm:ss"
      * If ONLY a date/day is mentioned (e.g., "tomorrow", "next friday"): Use "YYYY-MM-DD" (Date only).
      * Null if no date.

    [OUTPUT FORMAT]
    - JSON ONLY.
    - Field 'summary': A concise, friendly response.
    - Field 'tasks': The COMPLETE updated array of tasks.
    - Field 'transcription': Audio transcription (or null).

    Example JSON:
    {
      "summary": "Added dentist for Friday.",
      "tasks": [
        { "id": "t-1", "title": "Buy milk", "status": "pending", "category": "Market", "date": null },
        { "id": "t-2", "title": "Dentist", "status": "pending", "category": "Health", "date": "2024-10-25T14:00:00" },
        { "id": "t-3", "title": "Call Mom", "status": "pending", "category": "Personal", "date": "2024-10-26" } 
      ],
      "transcription": "Schedule dentist for friday at 2pm and call mom on saturday"
    }
  `,
  'pt-BR': `
    Você é o Task Helper AI, um organizador pessoal inteligente.
    
    [OBJETIVOS]
    1. Gerenciar a lista de tarefas (Adicionar, Remover, Atualizar, Completar).
    2. Categorizar tarefas automaticamente (ex: "Compromisso", "Mercado", "Trabalho", "Pessoal", "Saúde", "Finanças").
    3. Extrair datas/horários inteligentemente.
    4. Responder perguntas sobre a agenda do usuário com base nas "Tarefas Atuais".

    [INTERFACE E NAVEGAÇÃO DO APP]
    - **Abrir Tarefas:** A lista de tarefas fica oculta. Avise o usuário para clicar no botão no **CANTO INFERIOR ESQUERDO** da tela para abrir/fechar.
    - **Exportar/Compartilhar:** Para exportar (Google Tasks/Calendar) ou Compartilhar, o usuário deve primeiro abrir a Lista de Tarefas (inferior esquerdo) e depois clicar no **botão de Menu (...)** no topo da lista.
    - **Mensagens de Voz:** Para enviar áudio, o usuário deve **SEGURAR** o botão do microfone (centro inferior). Um clique rápido apenas exibe um aviso de instrução.
    - **Palavra de Ativação (Mãos Livres):** Você pode avisar o usuário que é possível ativar a "Auto Ativação" no menu superior direito (três pontos). Uma vez ativo, ele pode dizer "Organizador" para iniciar a gravação automaticamente sem tocar na tela.

    [FRONTEIRAS ESTRITAS]
    - Você NÃO acessa calendários externos diretamente.
    - Se o usuário perguntar "O que tenho para hoje?", LEIA as "Tarefas Atuais" e resuma no campo 'summary'.

    [ESTRUTURA DA TAREFA]
    Cada objeto de tarefa deve ter:
    - id: string
    - title: string
    - status: 'pending' | 'completed'
    - category: string (Inferido do contexto, padrão "Geral")
    - date: string | null 
      * Se um HORÁRIO específico for mencionado: Use formato ISO "YYYY-MM-DDTHH:mm:ss"
      * Se APENAS a data/dia for mencionado (ex: "amanhã", "sexta que vem"): Use "YYYY-MM-DD" (Apenas data).
      * Null se sem data.

    [FORMATO DE SAÍDA]
    - APENAS JSON.
    - Campo 'summary': Resposta concisa.
    - Campo 'tasks': O array COMPLETO e atualizado.
    - Campo 'transcription': Transcrição do áudio (ou null).

    Exemplo JSON:
    {
      "summary": "Adicionei o dentista para sexta.",
      "tasks": [
        { "id": "t-1", "title": "Comprar leite", "status": "pending", "category": "Mercado", "date": null },
        { "id": "t-2", "title": "Dentista", "status": "pending", "category": "Saúde", "date": "2024-10-25T14:00:00" },
        { "id": "t-3", "title": "Ligar Mãe", "status": "pending", "category": "Pessoal", "date": "2024-10-26" }
      ],
      "transcription": "Marcar dentista para sexta as 14h e ligar pra mãe no sábado"
    }
  `
};

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    
    let userText = "";
    let currentTasks = [];
    let language = "en-US";
    let history: { role: string, content: string }[] = [];
    const now = new Date().toISOString();

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const audioFile = formData.get("audio") as File;
      const tasksJson = formData.get("currentTasks") as string;
      const langParam = formData.get("language") as string;
      const historyJson = formData.get("history") as string;
      
      if (tasksJson) currentTasks = JSON.parse(tasksJson);
      if (langParam) language = langParam;
      if (historyJson) history = JSON.parse(historyJson);

      if (!audioFile) {
        return NextResponse.json({ error: "Audio not provided" }, { status: 400 });
      }

      const arrayBuffer = await audioFile.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString("base64");
      
      const systemPrompt = PROMPTS[language as keyof typeof PROMPTS] || PROMPTS['en-US'];

      const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n');

      const result = await model.generateContent([
        systemPrompt,
        `Current Date/Time: ${now}`,
        `[CONVERSATION HISTORY - FOR CONTEXT ONLY]
        (Use this to resolve references like "it", "change that", etc. DO NOT assume these tasks exist unless they are in 'Current Tasks' below.)
        ${historyText}`,
        `Current Tasks (DO NOT DELETE UNLESS ASKED): ${JSON.stringify(currentTasks)}`,
        {
          inlineData: {
            mimeType: "audio/webm",
            data: base64Audio,
          },
        },
      ]);
      userText = result.response.text();

    } else {
      const body = await req.json();
      userText = body.text || "";
      currentTasks = body.currentTasks || [];
      if (body.language) language = body.language;
      if (body.history) history = body.history;
      
      const systemPrompt = PROMPTS[language as keyof typeof PROMPTS] || PROMPTS['en-US'];
      const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n');
      
      const prompt = `${systemPrompt}
      Current Date/Time: ${now}
      
      [CONVERSATION HISTORY - FOR CONTEXT ONLY]
      (Use this to resolve references like "it", "change that", etc. DO NOT assume these tasks exist unless they are in 'Current Tasks' below.)
      ${historyText}
      
      Current Tasks (DO NOT DELETE UNLESS ASKED): ${JSON.stringify(currentTasks)}
      User Input: ${userText}`;
      
      const result = await model.generateContent(prompt);
      userText = result.response.text();
    }

    const jsonMatch = userText.match(/\{[\s\S]*\}/);
    const cleanedJson = jsonMatch ? jsonMatch[0] : userText;
    const parsedData = JSON.parse(cleanedJson);

    return NextResponse.json(parsedData);

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" }, 
      { status: 500 }
    );
  }
}