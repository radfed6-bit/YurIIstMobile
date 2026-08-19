import * as Crypto from "expo-crypto";
import { htmlToText } from "./htmlToText";
import { DEFAULT_WEB_SEARCH_MCP_URL, LLMConfig } from "./defaultConfig";

// ---------- rate limiting (как в исходном tools.py: 6 вызовов / 60 сек) ----------
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_CALLS = 6;
const rateLimiter: Record<string, number[]> = {};

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimiter[key] || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_MAX_CALLS) {
    rateLimiter[key] = timestamps;
    return false;
  }
  timestamps.push(now);
  rateLimiter[key] = timestamps;
  return true;
}

// ---------- базовая защита web_fetch от локальных/приватных адресов ----------
// Примечание: в отличие от исходного Python-сервера, здесь нет полноценного
// DNS-резолва с проверкой всех IP (защита от DNS rebinding) — react-native
// не даёт простого доступа к резолву на уровне приложения. Проверяем то, что
// можно проверить по строке (localhost, литеральные приватные IP). Это
// приложение личное и однопользовательское, а не публичный сервис, поэтому
// это принято как компромисс.
const BLOCKED_HOSTS = new Set(["localhost", "0.0.0.0"]);

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function isBlockedUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!host) return true;
    if (BLOCKED_HOSTS.has(host)) return true;
    if (host === "::1" || host.startsWith("fd") || host.startsWith("fe80")) return true;
    if (isPrivateIPv4(host)) return true;
    return false;
  } catch {
    return true;
  }
}

async function sha256Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

export async function webSearch(query: string, model: string): Promise<string> {
  if (!checkRateLimit("web_search")) {
    return JSON.stringify({ error: "Слишком много поисковых запросов. Подожди минуту." });
  }
  if (!DEFAULT_WEB_SEARCH_MCP_URL) {
    return JSON.stringify({ error: "Веб-поиск не настроен." });
  }

  const objective = `Найти актуальную информацию по российскому законодательству: ${query}`;
  const queryHash = await sha256Hex(query);
  const userIdHex = queryHash.slice(0, 8);
  const userId = parseInt(userIdHex, 16);
  const sessionSeed = await sha256Hex(`legal_cli_${userId}`);
  const sessionId = sessionSeed.slice(0, 32);

  try {
    const resp = await fetch(DEFAULT_WEB_SEARCH_MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "web_search",
          arguments: {
            objective,
            search_queries: [query.slice(0, 80)],
            session_id: sessionId,
            model_name: model,
          },
        },
        id: 1,
      }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data?.result?.content) {
      const texts = (data.result.content as any[]).map((item) => item.text || "");
      const combined = texts.join("\n\n").slice(0, 5000);
      return combined.trim() ? combined : JSON.stringify({ error: "Пустой результат поиска" });
    }
    return JSON.stringify({ error: "Нет результатов от поискового сервиса" });
  } catch (e) {
    return JSON.stringify({ error: "web_search: internal error" });
  }
}

export async function webFetch(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) {
    return JSON.stringify({ error: "Некорректный URL. Допускаются только http/https ссылки." });
  }
  if (isBlockedUrl(url)) {
    return JSON.stringify({ error: "Доступ к внутренним/локальным ресурсам запрещён." });
  }
  if (!checkRateLimit("web_fetch")) {
    return JSON.stringify({ error: "Слишком много запросов. Подожди минуту." });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      return JSON.stringify({ error: `Страница вернула ошибку ${resp.status}.` });
    }
    if (resp.url && resp.url !== url && isBlockedUrl(resp.url)) {
      return JSON.stringify({ error: "Редирект на внутренний ресурс запрещён." });
    }
    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("application/pdf")) {
      return JSON.stringify({ error: "Не могу обработать PDF." });
    }

    const html = await resp.text();
    let text = htmlToText(html);
    const MAX_FETCH = 15000;
    if (text.length > MAX_FETCH) {
      text = text.slice(0, MAX_FETCH) + "\n\n...(обрезано, полный текст по ссылке)";
    }
    return text.trim() ? text : JSON.stringify({ error: "Не удалось извлечь текст со страницы." });
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e?.name === "AbortError") {
      return JSON.stringify({ error: "Превышено время ожидания при загрузке страницы." });
    }
    return JSON.stringify({ error: "web_fetch: internal error" });
  }
}

export interface ToolContext {
  llmConfig: LLMConfig;
}
