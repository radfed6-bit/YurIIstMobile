export type DisplayRole = "user" | "assistant" | "error";

export interface DisplayMessage {
  role: DisplayRole;
  text: string;
  sources?: string[];
  thoughts?: string[];
}

export interface HistoryMessage {
  role: "user" | "assistant" | "tool";
  content: unknown;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

export interface Session {
  id: string;
  title: string;
  display: DisplayMessage[];
  history: HistoryMessage[];
  updatedAt: number;
}

export interface LLMSettings {
  model: string;
  base_url: string;
  api_key: string;
}

// Отдельного сервера больше нет — приложение полностью самодостаточно,
// поэтому настройки — это только параметры модели.
export type AppSettings = LLMSettings;

export interface AskDonePayload {
  answer: string;
  sources: string[];
  history: HistoryMessage[];
}
