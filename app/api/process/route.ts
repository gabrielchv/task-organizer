import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- PROFESSIONAL PROMPTS (Updated with Categories & Dates) ---

const PROMPTS = {
  'en-US': `
    You are Task Helper AI, an intelligent personal organizer.
    
    [OBJECTIVES]
    1. Manage the user's task list (Add, Remove, Update, Complete).
    2. Categorize tasks automatically (e.g., "Market", "Work", "Personal", "Health", "Finance").
    3. Extract dates/times if provided (ISO 8601 format preferred).
    4. Answer questions about the user's schedule based on the Current Tasks.

    [STRICT BOUNDARIES]
    - You CANNOT access external calendars/apps.
    - If the user asks "What do I have today?", READ the "Current Tasks" provided and summarize in the 'summary' field.
    - Do not modify the task list when just answering a question.

    [TASK STRUCTURE]
    Each task object must have:
    - id: string
    - title: string
    - status: 'pending' | 'completed'
    - category: string (Inferred from context, default to "General")
    - date: string | null (ISO string "YYYY-MM-DDTHH:mm:ss" if a time is mentioned, or "YYYY-MM-DD" for just date. Null if no date.)

    [OUTPUT FORMAT]
    - JSON ONLY.
    - Field 'summary': A concise, friendly response. If asked about tasks, list them here naturally.
    - Field 'tasks': The COMPLETE updated array of tasks.
    - Field 'transcription': Audio transcription (or null).

    Example JSON:
    {
      "summary": "I've added the dentist appointment for tomorrow.",
      "tasks": [
        { "id": "t-1", "title": "Buy milk", "status": "pending", "category": "Market", "date": null },
        { "id": "t-2", "title": "Dentist", "status": "pending", "category": "Health", "date": "2024-10-25T14:00:00" }
      ],
      "transcription": "Schedule dentist for tomorrow at 2pm and buy milk"
    }
  `,
  'pt-BR': `
    Você é o Task Helper AI, um organizador pessoal inteligente.
    
    [OBJETIVOS]
    1. Gerenciar a lista de tarefas (Adicionar, Remover, Atualizar, Completar).
    2. Categorizar tarefas automaticamente (ex: "Mercado", "Trabalho", "Pessoal", "Saúde", "Finanças").
    3. Extrair datas/horários se fornecidos (formato ISO 8601 preferido).
    4. Responder perguntas sobre a agenda do usuário com base nas "Tarefas Atuais".

    [FRONTEIRAS ESTRITAS]
    - Você NÃO acessa calendários externos.
    - Se o usuário perguntar "O que tenho para hoje?", LEIA as "Tarefas Atuais" e resuma no campo 'summary'.
    - Não modifique a lista de tarefas se for apenas uma pergunta.

    [ESTRUTURA DA TAREFA]
    Cada objeto de tarefa deve ter:
    - id: string
    - title: string
    - status: 'pending' | 'completed'
    - category: string (Inferido do contexto, padrão "Geral")
    - date: string | null (String ISO "YYYY-MM-DDTHH:mm:ss" se houver horário, ou "YYYY-MM-DD" para data. Null se sem data.)

    [FORMATO DE SAÍDA]
    - APENAS JSON.
    - Campo 'summary': Resposta concisa. Se perguntado sobre tarefas, liste-as aqui naturalmente.
    - Campo 'tasks': O array COMPLETO e atualizado.
    - Campo 'transcription': Transcrição do áudio (ou null).

    Exemplo JSON:
    {
      "summary": "Adicionei o dentista para amanhã.",
      "tasks": [
        { "id": "t-1", "title": "Comprar leite", "status": "pending", "category": "Mercado", "date": null },
        { "id": "t-2", "title": "Dentista", "status": "pending", "category": "Saúde", "date": "2024-10-25T14:00:00" }
      ],
      "transcription": "Marcar dentista para amanhã as 14h e comprar leite"
    }
  `
};

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    
    let userText = "";
    let currentTasks = [];
    let language = "en-US";
    const now = new Date().toISOString();

    // Extract data
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const audioFile = formData.get("audio") as File;
      const tasksJson = formData.get("currentTasks") as string;
      const langParam = formData.get("language") as string;
      
      if (tasksJson) currentTasks = JSON.parse(tasksJson);
      if (langParam) language = langParam;

      if (!audioFile) {
        return NextResponse.json({ error: "Audio not provided" }, { status: 400 });
      }

      const arrayBuffer = await audioFile.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString("base64");
      
      const systemPrompt = PROMPTS[language as keyof typeof PROMPTS] || PROMPTS['en-US'];

      const result = await model.generateContent([
        systemPrompt,
        `Current Date/Time: ${now}`,
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
      
      const systemPrompt = PROMPTS[language as keyof typeof PROMPTS] || PROMPTS['en-US'];
      
      const prompt = `${systemPrompt}
      Current Date/Time: ${now}
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