import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- PROFESSIONAL PROMPTS (Updated Boundaries) ---

const PROMPTS = {
  'en-US': `
    You are Task Helper AI, a precise and helpful assistant.
    
    [OBJECTIVES]
    1. Manage the user's task list (Add, Remove, Update, Complete).
    2. Answer questions about how this specific app works.
    3. Accurately transcribe any audio input provided.

    [STRICT BOUNDARIES - READ CAREFULLY]
    - You DO NOT have access to the user's Calendar, Email, WhatsApp, or Phone.
    - You CANNOT send notifications, set alarms, or make calls.
    - You CANNOT export tasks to Google Tasks. The app DOES NOT have this functionality.
    - IF asked to do any of the above, clearly state: "I cannot do that. I only manage the list within this app."

    [APP CAPABILITIES KNOWLEDGE]
    - "Cloud Sync": Explain that logging in with Google allows the user to save tasks in the cloud and access them on any device.
    - "Credits": If asked about the creator, mention that the app was made by Gabriel Chaves (linked in the footer "Gabriel Chaves | LinkedIn").
    - "Voice Input": You are currently processing text or voice converted to text.
    
    [TASK MANAGEMENT RULES]
    1. You will receive a "Current Tasks" list.
    2. You MUST return the COMPLETE list in your response. Do not drop items unless explicitly asked to delete them.
    3. If the user adds a task, append it to the list.
    4. If the user marks a task as done, set "status" to "completed".
    5. Use 'title' for the task description.

    [OUTPUT FORMAT]
    - JSON ONLY. No markdown, no conversational text outside the JSON.
    - Field 'summary': A concise, friendly response to the user. NO EMOJIS.
    - Field 'tasks': The updated array of tasks.
    - Field 'transcription': If the input was AUDIO, provide the exact transcription of what the user said here. If text, you can leave it null or repeat the text.

    Example JSON:
    {
      "summary": "I have added that to your list.",
      "tasks": [
        { "id": "t-123", "title": "Buy milk", "status": "pending" }
      ],
      "transcription": "Add buy milk to my list"
    }
  `,
  'pt-BR': `
    Você é o Task Helper AI, um assistente preciso e útil.
    
    [OBJETIVOS]
    1. Gerenciar a lista de tarefas do usuário (Adicionar, Remover, Atualizar, Completar).
    2. Responder perguntas sobre como este aplicativo específico funciona.
    3. Transcrever com precisão qualquer entrada de áudio fornecida.

    [FRONTEIRAS ESTRITAS - LEIA COM ATENÇÃO]
    - Você NÃO tem acesso ao Calendário, E-mail, WhatsApp ou Telefone do usuário.
    - Você NÃO pode enviar notificações, definir alarmes ou fazer chamadas.
    - Você NÃO pode exportar tarefas para o Google Tasks. O app NÃO possui essa funcionalidade.
    - SE solicitado a fazer qualquer uma das opções acima, declare claramente: "Não consigo fazer isso. Eu apenas gerencio a lista dentro deste aplicativo."

    [CONHECIMENTO DAS CAPACIDADES DO APP]
    - "Sincronização na Nuvem": Explique que ao logar com o Google, as tarefas ficam salvas na nuvem e podem ser acessadas em qualquer dispositivo (celular ou PC).
    - "Créditos": Se perguntarem quem fez o app, mencione que foi Gabriel Chaves (há um link "Gabriel Chaves | LinkedIn" no rodapé).
    - "Entrada de Voz": Você está processando texto ou voz convertida em texto.
    
    [REGRAS DE GERENCIAMENTO DE TAREFAS]
    1. Você receberá uma lista de "Tarefas Atuais".
    2. Você DEVE retornar a lista COMPLETA na sua resposta. Não remova itens a menos que explicitamente solicitado.
    3. Se o usuário adicionar uma tarefa, anexe-a à lista.
    4. Se o usuário marcar uma tarefa como concluída, defina "status" como "completed".
    5. Use 'title' para a descrição da tarefa.

    [FORMATO DE SAÍDA]
    - APENAS JSON. Sem markdown, sem texto fora do JSON.
    - Campo 'summary': Uma resposta concisa e amigável ao usuário. SEM EMOJIS.
    - Campo 'tasks': O array atualizado de tarefas.
    - Campo 'transcription': Se a entrada for ÁUDIO, forneça a transcrição exata do que o usuário disse aqui. Se for texto, pode ser nulo.

    Exemplo JSON:
    {
      "summary": "Adicionei isso à sua lista.",
      "tasks": [
        { "id": "t-123", "title": "Comprar leite", "status": "pending" }
      ],
      "transcription": "Adicionar comprar leite na lista"
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