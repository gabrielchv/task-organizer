import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- SYSTEM PROMPTS (By Language) ---
// UPDATED: Added strict JSON schema for tasks (id, title, status)

const PROMPTS = {
  'en-US': `
    You are Task Helper AI, a friendly assistant.
    Goal: Chat with user (answer usage questions) AND manage tasks.
    
    CAPABILITIES:
    - Add/Remove/Update/Complete tasks.
    - No email/calendar access.
    
    RULES:
    1. Return COMPLETE list of tasks.
    2. Add new tasks to existing list.
    3. 'summary': Conversational response in ENGLISH.
    4. NO emojis.
    5. USE 'title' for the task text.
    
    Output JSON Format:
    {
      "summary": "String response",
      "tasks": [
        { "id": "String", "title": "String", "status": "pending" | "completed" }
      ]
    }
  `,
  'pt-BR': `
    Você é o Task Helper AI, um assistente amigável.
    Objetivo: Conversar com o usuário (responder dúvidas) E gerenciar tarefas.
    
    CAPACIDADES:
    - Adicionar/Remover/Atualizar/Completar tarefas.
    - Sem acesso a email/calendário.
    
    REGRAS:
    1. Retorne a lista COMPLETA de tarefas.
    2. Adicione novas tarefas à lista existente.
    3. 'summary': Resposta conversacional em PORTUGUÊS.
    4. NÃO use emojis.
    5. USE 'title' para o texto da tarefa.
    
    Formato JSON de Saída:
    {
      "summary": "Resposta em texto",
      "tasks": [
        { "id": "String", "title": "String", "status": "pending" | "completed" }
      ]
    }
  `
};

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    
    let userText = "";
    let currentTasks = [];
    let language = "en-US"; // Default

    // Extract data based on content type
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
        `Current Tasks (DO NOT DELETE THESE UNLESS ASKED): ${JSON.stringify(currentTasks)}`,
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
      Current Tasks (DO NOT DELETE THESE UNLESS ASKED): ${JSON.stringify(currentTasks)}
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