export interface Task {
  id: string;
  title: string;
  status: 'pending' | 'completed';
  category?: string;
  date?: string | null;
}

export interface Message {
  id: string;
  type: 'user' | 'bot';
  content?: string;
  audioUrl?: string;
  transcription?: string;
}

export interface ApiResponse {
  summary: string;
  tasks: Task[];
  transcription?: string;
  error?: string;
}