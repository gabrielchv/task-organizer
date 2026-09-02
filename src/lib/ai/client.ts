import { GoogleGenAI } from "@google/genai";
import { serverEnv } from "@/lib/env";

export const DEFAULT_MODEL = "gemini-2.5-flash";

let cached: GoogleGenAI | undefined;

export function genAI(): GoogleGenAI {
  if (!cached) cached = new GoogleGenAI({ apiKey: serverEnv().GEMINI_API_KEY });
  return cached;
}
