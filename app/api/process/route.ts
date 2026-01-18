import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Instructions in English to ensure English responses
const SYSTEM_INSTRUCTION = `
You are a Task Helper AI.
Your goal is to manage a list of tasks based on user commands.

Rules:
1. Analyze the "Current Tasks" and the "User Input".
2. Decide whether to ADD, REMOVE, UPDATE (change title), or COMPLETE/UNCOMPLETE tasks.
3. Keep tasks that were not affected.
4. If the user asks to remove/delete, remove it from the list.
5. If the user says they did something, mark status as 'completed'.
6. OUTPUT ONLY VALID JSON.

Output Format (JSON):
{
  "summary": "A short, natural sentence explaining what you did (e.g., 'Added buy milk' or 'Marked X as done'). Use first person ('I').",
  "tasks": [
    { "id": "keep_original_id_if_exists", "title": "Task title", "status": "pending" | "completed" }
  ]
}

For new tasks, generate a short, unique ID (e.g., 't-123').
`;

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    
    let userText = "";
    let currentTasks = [];

    // Handle Multipart (Audio) or JSON (Text)
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

      // Multimodal prompt
      const result = await model.generateContent([
        SYSTEM_INSTRUCTION,
        `Current Tasks: ${JSON.stringify(currentTasks)}`,
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
      Current Tasks: ${JSON.stringify(currentTasks)}
      User Input: ${userText}`;
      
      const result = await model.generateContent(prompt);
      userText = result.response.text();
    }

    // JSON Cleanup
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