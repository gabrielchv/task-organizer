export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  /** Assistant prose, or the user's typed text. Empty while streaming starts. */
  content: string;
  /** Object URL for a recorded message, when the user spoke. */
  audioUrl?: string;
  /** Filled in when the assistant reports what it heard. */
  transcription?: string;
  streaming?: boolean;
  failed?: boolean;
}
