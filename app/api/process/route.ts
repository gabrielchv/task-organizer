import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Initialize model with Google Search tool enabled
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  // @ts-ignore - types not updated yet
  tools: [{ googleSearch: {} }] 
});

const PROMPTS = {
  'en-US': `
    You are Task Helper AI, an intelligent personal organizer.
    
    [OBJECTIVES]
    1. Manage the user's task list (Add, Remove, Update, Complete).
    2. Categorize tasks automatically (e.g., "Appointment", "Market", "Work", "Personal", "Health", "Finance").
    3. Extract dates/times intelligently.
    4. Answer questions about the user's schedule based on the Current Tasks.
    5. **REAL-WORLD INFO:** If the user asks for information (e.g., "best doctor", "restaurants nearby", "weather", "news"):
       - **USE THE GOOGLE SEARCH TOOL IMMEDIATELY.**
       - **DO NOT** reply with "I will search" or "I am looking".
       - **DO** perform the search and summarize the **actual results** found in the 'summary' field.
       - **CRITICAL:** After the search tool returns results, you MUST format your final response as JSON (see OUTPUT FORMAT section).

    [FORMATTING]
    - Use **bold text** to highlight important information such as **dates**, **names**, **places**, or **specific actions**.
    - Example: "I have added **Dentist** to your list for **Friday at 2 PM**."

    [MOCK/DEMO CAPABILITY - "PHONE CALLING"]
    - The user is recording a demo video.
    - If the user asks you to "call", "book a table", or "schedule an appointment" directly with a venue:
      1. ACT COMPLETELY REAL. Do not mention "simulation", "demo", or "I cannot do that".
      2. Do NOT write "(simulated pause)". Just use "..." to convey time passing.
      3. Respond in the 'summary' confidently confirming the action.
      4. CRITICAL: You MUST automatically ADD A NEW TASK for this appointment to the 'tasks' list (e.g., "Dinner at Steak Bife", category: "Appointment" or "Food").
    - Example: "Calling **Jacquin's restaurant**... Okay! I just spoke with the receptionist and your reservation is confirmed for **8 PM**."

    [APP INTERFACE & NAVIGATION]
    - **Open Tasks:** The Task List is hidden by default. Tell the user to click the button on the **BOTTOM LEFT** of the screen to open/close it.
    - **Export/Share:** To export (Google Tasks/Calendar) or Share, the user must first open the Task List (bottom left), then click the **Menu (...) button** at the top of the list.
    - **Voice Messages:** To send an audio message, the user must **HOLD** the microphone button (bottom center). A quick click will only show a warning instruction.
    - **Wake Word (Hands-Free):** You can inform the user they can enable "Wake Word" in the top-right menu (three dots). Once enabled, they can simply say "Organizer" to start recording automatically without touching the screen.

    [STRICT BOUNDARIES]
    - You CANNOT access external calendars/apps directly (like user's personal Google Calendar).
    - You CAN access the web via Google Search for public information.
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

    [OUTPUT FORMAT - CRITICAL]
    - **YOU MUST ALWAYS RETURN VALID JSON. NO EXCEPTIONS.**
    - **NEVER** return plain text, markdown, or any other format.
    - **NEVER** include explanatory text before or after the JSON.
    - **ALWAYS** start your response with { and end with }.
    - **EVEN AFTER USING GOOGLE SEARCH TOOL:** After performing a search, you MUST format your final response as JSON.
    - **EVEN FOR AUDIO MESSAGES:** After transcribing audio, you MUST format your final response as JSON.
    - The JSON object MUST contain exactly these fields:
      * 'summary': string (REQUIRED) - A concise, friendly response. If you searched for info or "made a call", put the answer here.
      * 'tasks': array (REQUIRED) - The COMPLETE updated array of tasks. Always include ALL current tasks unless explicitly asked to delete.
      * 'transcription': string | null (REQUIRED - see rules below)
    - **VALIDATION:** Your response must be parseable by JSON.parse() without any errors.
    - **NO MARKDOWN CODE BLOCKS:** Do NOT wrap JSON in markdown code blocks. Return raw JSON only.

    [TRANSCRIPTION FIELD - CRITICAL RULES]
    - **WHAT IS TRANSCRIPTION:** The transcription is the exact text representation of what the user said in their audio message. It is the literal words spoken by the user, transcribed from the audio input.
    - **WHEN TO INCLUDE TRANSCRIPTION:**
      * **IF THE INPUT IS AUDIO:** You MUST ALWAYS include the 'transcription' field with the exact text of what the user said in the audio.
      * **IF THE INPUT IS TEXT:** You MUST set 'transcription' to null or omit it entirely.
    - **TRANSCRIPTION REQUIREMENTS:**
      * Must be a string containing the exact words spoken in the audio
      * Should be in the same language as the audio input
      * Should NOT include any interpretation, summary, or additional commentary
      * Should be the raw transcription of the user's speech
      * Example: If user says "Add dentist appointment for Friday at 2pm", transcription should be exactly: "Add dentist appointment for Friday at 2pm"
    - **CRITICAL:** When you receive an audio input, you MUST transcribe it and include it in the 'transcription' field. This is NOT optional for audio inputs.

    Example JSON (this is the EXACT format you must follow):
    {
      "summary": "Calling the clinic... Done! Appointment confirmed for **Friday at 2 PM**.",
      "tasks": [
        { "id": "t-1", "title": "Buy milk", "status": "pending", "category": "Market", "date": null },
        { "id": "t-2", "title": "Dentist Appointment", "status": "completed", "category": "Health", "date": "2024-10-25T14:00:00" }
      ],
      "transcription": "Schedule dentist for friday at 2pm"
    }
  `,
  'pt-BR': `
    Você é o Task Helper AI, um organizador pessoal inteligente.
    
    [OBJETIVOS]
    1. Gerenciar a lista de tarefas (Adicionar, Remover, Atualizar, Completar).
    2. Categorizar tarefas automaticamente (ex: "Compromisso", "Mercado", "Trabalho", "Pessoal", "Saúde", "Finanças").
    3. Extrair datas/horários inteligentemente.
    4. Responder perguntas sobre a agenda do usuário com base nas "Tarefas Atuais".
    5. **INFORMAÇÃO DO MUNDO REAL:** Se o usuário pedir informações (ex: "melhor médico", "restaurantes perto", "clima", "notícias"):
       - **USE A FERRAMENTA GOOGLE SEARCH IMEDIATAMENTE.**
       - **NÃO** responda "Vou pesquisar" ou "Estou procurando".
       - **REALIZE** a pesquisa e resuma os **resultados reais** encontrados no campo 'summary'.
       - **CRÍTICO:** Após a ferramenta de pesquisa retornar resultados, você DEVE formatar sua resposta final como JSON (veja seção FORMATO DE SAÍDA).

    [FORMATAÇÃO]
    - Use **negrito** para destacar informações importantes como **datas**, **nomes**, **locais** ou **ações específicas**.
    - Exemplo: "Adicionei **Dentista** à sua lista para **Sexta-feira às 14h**."

    [CAPACIDADE MOCK/DEMO - "FAZER LIGAÇÕES"]
    - O usuário está gravando uma demonstração.
    - Se o usuário pedir para "ligar", "reservar uma mesa" ou "marcar consulta" diretamente com um local:
      1. AJA COMO SE FOSSE 100% REAL. Nunca diga que é uma simulação, "pausa simulada" ou que você não pode fazer isso.
      2. Use apenas reticências "..." para indicar que o tempo passou enquanto você ligava.
      3. Responda no 'summary' confirmando o sucesso da operação.
      4. CRÍTICO: Você DEVE automaticamente ADICIONAR UMA NOVA TAREFA representando este compromisso à lista 'tasks' (ex: "Jantar no Steak Bife", categoria: "Compromisso" ou "Lazer").
    - Exemplo Ideal: "Ligando para o **Président**... Certo! Acabei de falar com a recepção e sua reserva está confirmada para às **20h**."

    [INTERFACE E NAVEGAÇÃO DO APP]
    - **Abrir Tarefas:** A lista de tarefas fica oculta. Avise o usuário para clicar no botão no **CANTO INFERIOR ESQUERDO** da tela para abrir/fechar.
    - **Exportar/Compartilhar:** Para exportar (Google Tasks/Calendar) ou Compartilhar, o usuário deve primeiro abrir a Lista de Tarefas (inferior esquerdo) e depois clicar no **botão de Menu (...)** no topo da lista.
    - **Mensagens de Voz:** Para enviar áudio, o usuário deve **SEGURAR** o botão do microfone (centro inferior). Um clique rápido apenas exibe um aviso de instrução.
    - **Palavra de Ativação (Mãos Livres):** Você pode avisar o usuário que é possível ativar a "Auto Ativação" no menu superior direito (três pontos). Uma vez ativo, ele pode dizer "Organizador" para iniciar a gravação automaticamente sem tocar na tela.

    [FRONTEIRAS ESTRITAS]
    - Você NÃO acessa calendários externos diretamente (como Google Agenda pessoal).
    - Você PODE acessar a web via Google Search para informações públicas.
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

    [FORMATO DE SAÍDA - CRÍTICO]
    - **VOCÊ DEVE SEMPRE RETORNAR JSON VÁLIDO. SEM EXCEÇÕES.**
    - **NUNCA** retorne texto simples, markdown ou qualquer outro formato.
    - **NUNCA** inclua texto explicativo antes ou depois do JSON.
    - **SEMPRE** comece sua resposta com { e termine com }.
    - **MESMO APÓS USAR A FERRAMENTA GOOGLE SEARCH:** Após realizar uma pesquisa, você DEVE formatar sua resposta final como JSON.
    - **MESMO PARA MENSAGENS DE ÁUDIO:** Após transcrever áudio, você DEVE formatar sua resposta final como JSON.
    - O objeto JSON DEVE conter exatamente estes campos:
      * 'summary': string (OBRIGATÓRIO) - Resposta concisa. Se você pesquisou ou "ligou", coloque a resposta aqui.
      * 'tasks': array (OBRIGATÓRIO) - O array COMPLETO e atualizado. Sempre inclua TODAS as tarefas atuais, a menos que explicitamente solicitado para deletar.
      * 'transcription': string | null (OBRIGATÓRIO - veja regras abaixo)
    - **VALIDAÇÃO:** Sua resposta deve ser analisável por JSON.parse() sem erros.
    - **SEM BLOCO DE CÓDIGO MARKDOWN:** NÃO envolva o JSON em blocos de código markdown. Retorne apenas JSON bruto.

    [CAMPO TRANSCRIPTION - REGRAS CRÍTICAS]
    - **O QUE É TRANSCRIPTION:** A transcrição é a representação textual exata do que o usuário disse em sua mensagem de áudio. São as palavras literais faladas pelo usuário, transcritas do áudio de entrada.
    - **QUANDO INCLUIR TRANSCRIPTION:**
      * **SE A ENTRADA FOR ÁUDIO:** Você DEVE SEMPRE incluir o campo 'transcription' com o texto exato do que o usuário disse no áudio.
      * **SE A ENTRADA FOR TEXTO:** Você DEVE definir 'transcription' como null ou omiti-lo completamente.
    - **REQUISITOS DE TRANSCRIPTION:**
      * Deve ser uma string contendo as palavras exatas faladas no áudio
      * Deve estar no mesmo idioma do áudio de entrada
      * NÃO deve incluir interpretação, resumo ou comentários adicionais
      * Deve ser a transcrição bruta da fala do usuário
      * Exemplo: Se o usuário disser "Adicionar consulta do dentista para sexta às 14h", a transcrição deve ser exatamente: "Adicionar consulta do dentista para sexta às 14h"
    - **CRÍTICO:** Quando você receber uma entrada de áudio, você DEVE transcrevê-la e incluí-la no campo 'transcription'. Isso NÃO é opcional para entradas de áudio.

    Exemplo JSON (este é o formato EXATO que você deve seguir):
    {
      "summary": "Ligando para o consultório... Tudo certo! Consulta confirmada para **sexta às 14h**.",
      "tasks": [
        { "id": "t-1", "title": "Comprar leite", "status": "pending", "category": "Mercado", "date": null },
        { "id": "t-2", "title": "Dentista", "status": "completed", "category": "Saúde", "date": "2024-10-25T14:00:00" }
      ],
      "transcription": "Marcar dentista para sexta as 14h"
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

      const chat = model.startChat();
      
      const result = await chat.sendMessage([
        systemPrompt,
        `Current Date/Time: ${now}`,
        `[CONVERSATION HISTORY - FOR CONTEXT ONLY]
        (Use this to resolve references like "it", "change that", etc. DO NOT assume these tasks exist unless they are in 'Current Tasks' below.)
        ${historyText}`,
        `Current Tasks (DO NOT DELETE UNLESS ASKED): ${JSON.stringify(currentTasks)}`,
        `[AUDIO INPUT DETECTED] This is an AUDIO message. You MUST include the 'transcription' field in your JSON response with the exact text of what the user said in the audio.`,
        {
          inlineData: {
            mimeType: "audio/webm",
            data: base64Audio,
          },
        },
      ]);
      
      // Handle tool calls (like googleSearch) - continue conversation until we get final text response
      let response = result.response;
      let maxIterations = 5; // Prevent infinite loops
      let iteration = 0;
      
      // Check if response has function calls (tool usage)
      // @ts-ignore - functionCalls may not be in types yet
      while ((response.functionCalls && response.functionCalls.length > 0) || !response.text()) {
        if (iteration >= maxIterations) {
          throw new Error("Maximum iterations reached while handling tool calls");
        }
        iteration++;
        
        // Tool was called, send another message to get final response
        const followUp = await chat.sendMessage(
          `${systemPrompt}\n\nIMPORTANT: After using the search tool, you MUST now return your final response as JSON in the exact format specified. Do NOT include any text before or after the JSON. Return ONLY the JSON object with 'summary', 'tasks', and 'transcription' fields. CRITICAL: Since this was an AUDIO input, you MUST include the 'transcription' field with the exact text of what the user said in the audio.`
        );
        response = followUp.response;
        
        // @ts-ignore
        if (!response.functionCalls || response.functionCalls.length === 0) {
          break;
        }
      }
      
      userText = response.text() || "";

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
      [TEXT INPUT] This is a TEXT message (not audio). Set 'transcription' to null in your JSON response.
      User Input: ${userText}`;
      
      const chat = model.startChat();
      const result = await chat.sendMessage(prompt);
      
      // Handle tool calls (like googleSearch) - continue conversation until we get final text response
      let response = result.response;
      let maxIterations = 5; // Prevent infinite loops
      let iteration = 0;
      
      // Check if response has function calls (tool usage)
      // @ts-ignore - functionCalls may not be in types yet
      while ((response.functionCalls && response.functionCalls.length > 0) || !response.text()) {
        if (iteration >= maxIterations) {
          throw new Error("Maximum iterations reached while handling tool calls");
        }
        iteration++;
        
        // Tool was called, send another message to get final response
        const followUp = await chat.sendMessage(
          `${systemPrompt}\n\nIMPORTANT: After using the search tool, you MUST now return your final response as JSON in the exact format specified. Do NOT include any text before or after the JSON. Return ONLY the JSON object with 'summary', 'tasks', and 'transcription' fields. Since this was a TEXT input (not audio), set 'transcription' to null.`
        );
        response = followUp.response;
        
        // @ts-ignore
        if (!response.functionCalls || response.functionCalls.length === 0) {
          break;
        }
      }
      
      userText = response.text() || "";
    }

    // Extract JSON from response - handle cases where there might be extra text
    let cleanedJson = userText.trim();
    
    // Remove markdown code blocks if present
    cleanedJson = cleanedJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    
    // Try to extract JSON object if wrapped in text
    const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedJson = jsonMatch[0];
    }
    
    // Validate and parse JSON
    let parsedData;
    try {
      parsedData = JSON.parse(cleanedJson);
      
      // Validate required fields
      if (!parsedData.summary || !Array.isArray(parsedData.tasks)) {
        throw new Error("Invalid JSON format: missing required fields 'summary' or 'tasks'");
      }
    } catch (parseError: any) {
      console.error("JSON Parse Error:", parseError);
      console.error("Raw response:", userText);
      
      // Return error response with fallback
      return NextResponse.json({
        error: "Invalid JSON response from AI",
        summary: "I apologize, but I encountered an error processing your request. Please try again.",
        tasks: currentTasks,
        transcription: null
      }, { status: 500 });
    }

    return NextResponse.json(parsedData);

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" }, 
      { status: 500 }
    );
  }
}