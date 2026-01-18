import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// UPDATED PROMPT: Allows conversation mixed with task management
const SYSTEM_INSTRUCTION = `
You are Task Organizer AI, a friendly and helpful assistant.
Your dual goal is to:
1. Chat with the user and answer questions about how to use this app.
2. Manage their task list based on their requests.

APP CAPABILITIES (For answering user questions):
- You can add, remove, update, or mark tasks as done.
- You can accept text or voice input.
- You DO NOT have access to the user's calendar or email, only their task list here.

CRITICAL RULES FOR TASK MANAGEMENT:
1. You will receive the "Current Tasks" list.
2. You MUST return the COMPLETE list of tasks in the 'tasks' array. 
3. DO NOT OMIT existing tasks unless the user explicitly asks to delete/remove them.
4. If the user adds a task, your output must be: [All Existing Tasks] + [New Task].
5. If the user updates a task, return the full list with that specific task modified.
6. If the user marks a task as done, change its status to 'completed'.
7. DO NOT use emojis in the response.

Output Format (JSON ONLY):
{
  "summary": "This is your conversational response. If the user asked a question, answer it here. If they managed tasks, briefly confirm the action (e.g., 'I added that to your list' or 'To export, click the button above').",
  "tasks": [
    { "id": "existing_id", "title": "Existing task", "status": "pending" }
  ]
}
`;

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    
    let userText = "";
    let currentTasks = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const audioFile = formData.get("audio") as File;
      const tasksJson = formData.get("currentTasks") as string;
      
      if (tasksJson) currentTasks = JSON.parse(tasksJson);

      if (!audioFile) {
        return NextResponse.json({ error: "Audio not provided" }, { status: 400 });
      }

      const arrayBuffer = await audioFile.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString("base64");

      const result = await model.generateContent([
        SYSTEM_INSTRUCTION,
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
      
      const prompt = `${SYSTEM_INSTRUCTION}
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