import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Initialize model with Google Search tool enabled
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  // @ts-ignore - types not updated yet
  tools: [{ googleSearch: {} }] 
});

// Initialize fallback model with responseSchema (no tools, for JSON formatting)
const fallbackModel = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  // @ts-ignore - types not updated yet
  responseMimeType: "application/json",
  // @ts-ignore - types not updated yet
  responseJsonSchema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "Brief summary response (1-2 sentences max)"
      },
      tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            status: { type: "string", enum: ["pending", "completed"] },
            category: { type: "string" },
            date: { 
              anyOf: [
                { type: "string" },
                { type: "null" }
              ]
            }
          },
          required: ["id", "title", "status", "category", "date"]
        }
      },
      transcription: {
        anyOf: [
          { type: "string" },
          { type: "null" }
        ],
        description: "Exact transcription of user's audio input, or null for text input"
      }
    },
    required: ["summary", "tasks", "transcription"]
  }
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

    [FORMATTING & BREVITY]
    - **KEEP RESPONSES SHORT:** Maximum 1-2 sentences. Be direct and action-oriented.
    - Use **bold text** to highlight important information such as **dates**, **names**, **places**, or **specific actions**.
    - Examples: "Added **Dentist** for **Friday at 2 PM**." | "Done! **3 tasks** completed." | "**Meeting** moved to **3 PM**."

    [MOCK/DEMO CAPABILITY - "PHONE CALLING"]
    - The user is recording a demo video.
    - If the user asks you to "call", "book a table", or "schedule an appointment" directly with a venue:
      1. ACT COMPLETELY REAL. Do not mention "simulation", "demo", or "I cannot do that".
      2. Do NOT write "(simulated pause)". Just use "..." to convey time passing.
      3. Respond in the 'summary' confidently confirming the action.
      4. CRITICAL: You MUST automatically ADD A NEW TASK for this appointment to the 'tasks' list (e.g., "Dinner at Steak Bife", category: "Appointment" or "Food").
    - Example: "Calling **Jacquin's restaurant**... Okay! I just spoke with the receptionist and your reservation is confirmed for **8 PM**."

    [APP INTERFACE & NAVIGATION]
    - **IMPORTANT:** The interface instructions depend on the device type (desktop or mobile) provided in the request.
    - **MOBILE DEVICE:**
      * **Open Tasks:** The Task List is hidden by default. Tell the user to click the button on the **BOTTOM LEFT** of the screen to open/close it.
      * **Export/Share:** To export (Google Tasks/Calendar) or Share, the user must click the **Menu (...) button** at the top of the list and click the options.
      * **Voice Messages:** To send an audio message, the user must **HOLD** the microphone button (bottom center). A quick click will only show a warning instruction.
      * **Wake Word (Hands-Free):** You can inform the user they can enable "Wake Word" in the top-right menu (three dots). Once enabled, they can simply say "hey organizer" to start recording automatically without touching the screen.
    - **DESKTOP DEVICE:**
      * **Task List:** The Task List is visible on the **RIGHT SIDE** of the screen.
      * **Export/Share:** To export (Google Tasks/Calendar), copy or Share, click the options at the top of the task list.
      * **Voice Messages:** Click and hold the microphone button to send an audio message.
      * **Wake Word:** Can be enabled on top of the task list. Once enabled, say "hey organizer" to start recording.

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
      * 'summary': string (REQUIRED) - Keep responses BRIEF and CONCISE (1-2 sentences max). Be direct and friendly. If you searched for info or "made a call", put the answer here.
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

    [SUMMARY EXAMPLES - BE BRIEF AND CONCISE]
    Good concise summaries (1-2 sentences):
    - "Added **Dentist** for **Friday at 2 PM**."
    - "Done! **3 tasks** completed."
    - "**Dentist** removed from your list."
    - "You have **2 tasks** today: **Meeting** at 3pm and **Grocery shopping**."
    - "Found **5 restaurants** near you. Top pick: **La Bella** (4.8★, Italian)."
    - "Calling **Jacquin's**... Reservation confirmed for **8 PM**."
    - "Weather: **72°F, sunny** today. **Rain** expected tomorrow."
    - "**Meeting** moved to **3 PM**."
    
    Bad (too verbose):
    - "I have successfully added the dentist appointment to your task list for Friday at 2 PM. Is there anything else you would like me to help you with?"
    - "Great! I've completed marking those tasks as done. You're making excellent progress on your to-do list!"
    
    Example JSON (this is the EXACT format you must follow):
    {
      "summary": "Added **Dentist** for **Friday at 2 PM**.",
      "tasks": [
        { "id": "t-1", "title": "Buy milk", "status": "pending", "category": "Market", "date": null },
        { "id": "t-2", "title": "Dentist Appointment", "status": "pending", "category": "Health", "date": "2024-10-25T14:00:00" }
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

    [FORMATAÇÃO E BREVIDADE]
    - **MANTENHA AS RESPOSTAS CURTAS:** Máximo de 1-2 frases. Seja direto e orientado à ação.
    - Use **negrito** para destacar informações importantes como **datas**, **nomes**, **locais** ou **ações específicas**.
    - Exemplos: "Adicionei **Dentista** para **sexta às 14h**." | "Pronto! **3 tarefas** concluídas." | "**Reunião** movida para às **15h**."

    [CAPACIDADE MOCK/DEMO - "FAZER LIGAÇÕES"]
    - O usuário está gravando uma demonstração.
    - Se o usuário pedir para "ligar", "reservar uma mesa" ou "marcar consulta" diretamente com um local:
      1. AJA COMO SE FOSSE 100% REAL. Nunca diga que é uma simulação, "pausa simulada" ou que você não pode fazer isso.
      2. Use apenas reticências "..." para indicar que o tempo passou enquanto você ligava.
      3. Responda no 'summary' confirmando o sucesso da operação.
      4. CRÍTICO: Você DEVE automaticamente ADICIONAR UMA NOVA TAREFA representando este compromisso à lista 'tasks' (ex: "Jantar no Steak Bife", categoria: "Compromisso" ou "Lazer").
    - Exemplo Ideal: "Ligando para o **Président**... Certo! Acabei de falar com a recepção e sua reserva está confirmada para às **20h**."

    [INTERFACE E NAVEGAÇÃO DO APP]
    - **IMPORTANTE:** As instruções da interface dependem do tipo de dispositivo (desktop ou mobile) fornecido na solicitação.
    - **DISPOSITIVO MOBILE:**
      * **Abrir Tarefas:** A lista de tarefas fica oculta. Avise o usuário para clicar no botão no **CANTO INFERIOR ESQUERDO** da tela para abrir/fechar.
      * **Exportar/Compartilhar:** Para exportar (Google Tasks/Calendar) ou Compartilhar, o usuário deve clicar no **botão de Menu (...)** no topo da lista e clicar nas opções.
      * **Mensagens de Voz:** Para enviar áudio, o usuário deve **SEGURAR** o botão do microfone (centro inferior). Um clique rápido apenas exibe um aviso de instrução.
      * **Palavra de Ativação (Mãos Livres):** Você pode avisar o usuário que é possível ativar a "Auto Ativação" no menu superior direito (três pontos). Uma vez ativo, ele pode dizer "olá organizador" para iniciar a gravação automaticamente sem tocar na tela.
    - **DISPOSITIVO DESKTOP:**
      * **Lista de Tarefas:** A lista de tarefas está visível no **LADO DIREITO** da tela.
      * **Exportar/Compartilhar:** Para exportar (Google Tasks/Calendar) ou Compartilhar, clique nas opções no topo da lista de tarefas.
      * **Mensagens de Voz:** Clique e segure o botão do microfone para enviar uma mensagem de áudio.
      * **Palavra de Ativação:** Pode ser ativada na parte superior da lista de tarefas. Uma vez ativo, diga "olá organizador" para iniciar a gravação.

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
      * 'summary': string (OBRIGATÓRIO) - Mantenha as respostas BREVES e CONCISAS (máximo 1-2 frases). Seja direto e amigável. Se você pesquisou ou "ligou", coloque a resposta aqui.
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

    [EXEMPLOS DE SUMMARY - SEJA BREVE E CONCISO]
    Resumos concisos bons (1-2 frases):
    - "Adicionei **Dentista** para **sexta às 14h**."
    - "Pronto! **3 tarefas** concluídas."
    - "**Dentista** removido da sua lista."
    - "Você tem **2 tarefas** hoje: **Reunião** às 15h e **Compras**."
    - "Encontrei **5 restaurantes** perto de você. Melhor opção: **La Bella** (4.8★, Italiano)."
    - "Ligando para o **Jacquin's**... Reserva confirmada para às **20h**."
    - "Clima: **22°C, ensolarado** hoje. **Chuva** amanhã."
    - "**Reunião** movida para às **15h**."
    
    Ruim (muito verboso):
    - "Eu adicionei com sucesso a consulta do dentista à sua lista de tarefas para sexta-feira às 14h. Há mais alguma coisa com que eu possa ajudá-lo?"
    - "Ótimo! Marquei essas tarefas como concluídas. Você está fazendo um excelente progresso na sua lista de afazeres!"
    
    Exemplo JSON (este é o formato EXATO que você deve seguir):
    {
      "summary": "Adicionei **Dentista** para **sexta às 14h**.",
      "tasks": [
        { "id": "t-1", "title": "Comprar leite", "status": "pending", "category": "Mercado", "date": null },
        { "id": "t-2", "title": "Dentista", "status": "pending", "category": "Saúde", "date": "2024-10-25T14:00:00" }
      ],
      "transcription": "Marcar dentista para sexta as 14h"
    }
  `
};

/**
 * Fallback function to reformat non-JSON or malformed JSON responses using a model with responseSchema
 * Only called when the primary model fails to return valid JSON
 */
async function reformatResponseWithSchema(
  rawResponse: string,
  currentTasks: any[],
  language: string,
  isAudioInput: boolean
): Promise<any> {
  const systemPrompt = PROMPTS[language as keyof typeof PROMPTS] || PROMPTS['en-US'];
  
  const reformatPrompt = `${systemPrompt}

[CRITICAL TASK: REFORMAT RESPONSE]
The AI assistant returned a response that was not in valid JSON format. Your task is to extract the information from the following response and format it as valid JSON according to the schema.

Original response (may contain text, markdown, or partial JSON):
${rawResponse}

Current tasks (preserve these unless explicitly modified):
${JSON.stringify(currentTasks)}

${isAudioInput 
  ? "Note: This was an AUDIO input, so include the 'transcription' field with the exact text the user said in the audio."
  : "Note: This was a TEXT input, so set 'transcription' to null."
}

Extract the summary, tasks, and transcription from the original response. The responseSchema will enforce the correct JSON format automatically.`;

  try {
    const result = await fallbackModel.generateContent(reformatPrompt);
    let responseText = result.response.text();
    
    // Clean the response - remove markdown code blocks if present (even with responseSchema, sometimes it still wraps)
    responseText = responseText.trim();
    responseText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    
    // Try to extract JSON object if wrapped in text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }
    
    // Parse the JSON response (should be valid due to responseSchema)
    const parsed = JSON.parse(responseText);
    
    // Ensure tasks array exists and is valid
    if (!Array.isArray(parsed.tasks)) {
      parsed.tasks = currentTasks;
    }
    
    // Ensure required fields exist
    if (!parsed.summary) {
      parsed.summary = "I processed your request.";
    }
    
    // Ensure transcription is set correctly
    if (!isAudioInput) {
      parsed.transcription = null;
    }
    // If isAudioInput is true, keep whatever transcription was extracted (or null if not found)
    
    return parsed;
  } catch (error) {
    console.error("Fallback model error:", error);
    // Ultimate fallback: return a safe response
    return {
      summary: "I apologize, but I encountered an error processing your request. Please try again.",
      tasks: currentTasks,
      transcription: null
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    
    let userText = "";
    let currentTasks = [];
    let language = "en-US";
    let history: { role: string, content: string }[] = [];
    let now = new Date().toISOString(); // Fallback to server time if client doesn't provide
    let isAudioInput = false; // Track if input is audio for fallback function

    if (contentType.includes("multipart/form-data")) {
      isAudioInput = true;
      const formData = await req.formData();
      const audioFile = formData.get("audio") as File;
      const tasksJson = formData.get("currentTasks") as string;
      const langParam = formData.get("language") as string;
      const historyJson = formData.get("history") as string;
      const deviceTypeParam = formData.get("deviceType") as string;
      const currentDateTimeParam = formData.get("currentDateTime") as string;
      
      if (tasksJson) currentTasks = JSON.parse(tasksJson);
      if (langParam) language = langParam;
      if (historyJson) history = JSON.parse(historyJson);
      if (currentDateTimeParam) now = currentDateTimeParam; // Use client-provided date/time
      const deviceType = deviceTypeParam || 'mobile';

      if (!audioFile) {
        return NextResponse.json({ error: "Audio not provided" }, { status: 400 });
      }

      const arrayBuffer = await audioFile.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString("base64");
      
      // Detect the actual mimeType from the file, with fallback for iOS formats
      const fileMimeType = audioFile.type || "";
      let geminiMimeType = "audio/webm"; // Default
      
      // Map common audio formats to Gemini-supported formats
      // iPhone Safari typically records as audio/mp4 or audio/m4a
      if (fileMimeType.includes("mp4") || fileMimeType.includes("m4a") || fileMimeType === "audio/x-m4a") {
        geminiMimeType = "audio/mp4";
      } else if (fileMimeType.includes("aac")) {
        geminiMimeType = "audio/aac";
      } else if (fileMimeType.includes("webm")) {
        geminiMimeType = "audio/webm";
      } else if (fileMimeType.includes("ogg")) {
        geminiMimeType = "audio/ogg";
      } else if (fileMimeType.includes("wav")) {
        geminiMimeType = "audio/wav";
      } else if (fileMimeType.includes("mp3") || fileMimeType.includes("mpeg")) {
        geminiMimeType = "audio/mp3";
      } else if (fileMimeType) {
        // Use the file's mimeType if provided and it's a valid audio type
        geminiMimeType = fileMimeType;
      }
      
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
        `[DEVICE TYPE] User is on ${deviceType === 'desktop' ? 'DESKTOP' : 'MOBILE'} device. Use the appropriate interface instructions.`,
        `[AUDIO INPUT DETECTED] This is an AUDIO message. You MUST include the 'transcription' field in your JSON response with the exact text of what the user said in the audio.`,
        {
          inlineData: {
            mimeType: geminiMimeType,
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
      if (body.currentDateTime) now = body.currentDateTime; // Use client-provided date/time
      const deviceType = body.deviceType || 'mobile';
      
      const systemPrompt = PROMPTS[language as keyof typeof PROMPTS] || PROMPTS['en-US'];
      const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n');
      
      const prompt = `${systemPrompt}
      Current Date/Time: ${now}
      
      [CONVERSATION HISTORY - FOR CONTEXT ONLY]
      (Use this to resolve references like "it", "change that", etc. DO NOT assume these tasks exist unless they are in 'Current Tasks' below.)
      ${historyText}
      
      Current Tasks (DO NOT DELETE UNLESS ASKED): ${JSON.stringify(currentTasks)}
      [DEVICE TYPE] User is on ${deviceType === 'desktop' ? 'DESKTOP' : 'MOBILE'} device. Use the appropriate interface instructions.
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
      console.log("Using fallback model to reformat response...");
      
      // Use fallback model with responseSchema to reformat the response
      parsedData = await reformatResponseWithSchema(
        userText,
        currentTasks,
        language,
        isAudioInput
      );
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