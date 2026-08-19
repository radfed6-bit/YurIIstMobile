import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppSettings, Session } from "../types";
import { DEFAULT_LLM_CONFIG } from "./defaultConfig";

const SESSIONS_KEY = "legalcli.sessions.v1";
const CURRENT_KEY = "legalcli.currentSession.v1";
const SETTINGS_KEY = "legalcli.settings.v1";

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function loadSessions(): Promise<Record<string, Session>> {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Session>) : {};
  } catch {
    return {};
  }
}

export async function saveSessions(sessions: Record<string, Session>): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // quota / недоступно — молча игнорируем, как в веб-версии
  }
}

export async function loadCurrentId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

export async function saveCurrentId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CURRENT_KEY, id);
  } catch {
    // ignore
  }
}

// Дефолты — те же ключ/модель, что зашиты в приложение (defaultConfig.ts).
// Пользователь может переопределить их в Настройках; переопределение
// хранится здесь и перекрывает встроенные значения.
const DEFAULT_SETTINGS: AppSettings = {
  model: DEFAULT_LLM_CONFIG.model,
  base_url: DEFAULT_LLM_CONFIG.baseUrl,
  api_key: DEFAULT_LLM_CONFIG.apiKey,
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as AppSettings) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function defaultSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export function newSession(): Session {
  const id = genId();
  return { id, title: "Новое дело", display: [], history: [], updatedAt: Date.now() };
}

export function deriveTitle(display: Session["display"]): string {
  const firstUser = display.find((m) => m.role === "user");
  if (!firstUser) return "Новое дело";
  const t = firstUser.text.trim().replace(/\s+/g, " ");
  return t.length > 42 ? t.slice(0, 42) + "…" : t;
}
