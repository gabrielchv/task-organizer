import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const PROMPT = `
Extract tasks from the following content and return ONLY a valid JSON.
Do not include descriptions, return only task titles.
Format: {"tasks": [{"title": "task title"}]}
`;

export async function POST(req: NextRequest) {
  try {
    // Check Content-Type to decide between Audio or Text
    const contentType = req.headers.get("content-type") || "";
    let resultText = "";

    if (contentType.includes("multipart/form-data")) {
      // Audio Processing
      const formData = await req.formData();
      const audioFile = formData.get("audio") as File;

      if (!audioFile) {
        return NextResponse.json({ error: "Audio not provided" }, { status: 400 });
      }

      // Convert File to ArrayBuffer then to Base64
      const arrayBuffer = await audioFile.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString("base64");

      const result = await model.generateContent([
        PROMPT,
        {
          inlineData: {
            mimeType: "audio/webm", // Browser typically records in webm
            data: base64Audio,
          },
        },
      ]);
      resultText = result.response.text();

    } else {
      // Text Processing (JSON)
      const body = await req.json();
      const userText = body.text || "";
      
      const result = await model.generateContent(`${PROMPT} Text: ${userText}`);
      resultText = result.response.text();
    }

    // Clean JSON (Using [\s\S]* to match across newlines without 's' flag)
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const cleanedJson = jsonMatch ? jsonMatch[0] : resultText;

    // Attempt to parse to ensure valid JSON before returning
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