import { HistoryMessage } from "../types";
import { getArticle, searchLegalDb } from "./legalDb";
import { webFetch, webSearch } from "./tools";
import { LLMConfig } from "./defaultConfig";

const MAX_ITERATIONS = 25;
const MAX_TOTAL_TOKENS = 500_000;
const RETRIES = 3;

export const ALLOWED_SLUGS = new Set([
  "uk-rf", "gk-rf-ch1", "gk-rf-ch2", "gk-rf-ch3", "gk-rf-ch4",
  "koap-rf", "konstitutsiya", "tk-rf", "semya-rf", "nk-rf-ch1", "nk-rf-ch2",
  "apk-rf", "kas-rf", "upk-rf", "gpk-rf", "fz-ob-obrazovanii",
  "fz-o-voinskoi-obyazannosti", "fz-o-statuse-voennosluzhashchikh",
  "fz-ob-oborone", "fz-o-poryadke-vyezda", "fz-o-personalnykh-dannykh",
  "fz-o-zakupkakh", "fz-o-kontraktnoi-sisteme", "zozpp",
  "ppvs-17", "ppvs-29", "ppvs-58", "ppvs-10-22",
]);

const SLUGS_LIST = Array.from(ALLOWED_SLUGS).sort().join(", ");

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_legal_db",
      description:
        "Поиск статей и пунктов в кодексах РФ и ППВС через полнотекстовый поиск. Используй для поиска релевантных статей/пунктов по любому юридическому вопросу. Можно ограничить документом через doc_slug. FTS5-синтаксис: слова через пробел (AND), OR для альтернатив, кавычки для точной фразы.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Поисковый запрос. FTS5-синтаксис." },
          top_k: { type: "integer", description: "Количество результатов (макс 20)", default: 10 },
          doc_slug: { type: "string", description: `Slug документа: ${SLUGS_LIST}`, default: null },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_article",
      description: "Получить полный текст конкретной статьи (или пункта) кодекса или ППВС.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: `Slug документа: ${SLUGS_LIST}` },
          article_number: { type: "string", description: "Номер статьи (например: '105', '158', '12.1')" },
        },
        required: ["slug", "article_number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Поиск в интернете для получения актуальной информации: изменения законодательства, судебная практика, комментарии, новости.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Поисковый запрос на русском языке" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description: "Загрузить содержимое страницы по URL (pravo.gov.ru, consultant.ru и т.п.). Не для PDF.",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "Полный URL (только http/https)" } },
        required: ["url"],
      },
    },
  },
];

const SYSTEM_PROMPT = `Ты — юридический ассистент «ЮрИИст», эксперт по законодательству РФ.

У тебя есть доступ к инструментам:
1. search_legal_db — поиск статей в кодексах РФ
2. get_article — получение полного текста статьи
3. web_search — поиск в интернете (изменения, комментарии, практика)
4. web_fetch — загрузка конкретной страницы по URL

АЛГОРИТМ РАБОТЫ:
1. search_legal_db — найди релевантные статьи
2. get_article — при необходимости прочитай статью целиком
3. web_search — проверь актуальность (необязательно)
4. ОТВЕЧАЙ. Если информации не хватает — продолжай вызывать инструменты.

ПРАВИЛА:
- Используй инструменты пока не соберёшь достаточно информации для полного ответа
- Ссылайся на конкретные статьи: «ст. 105 УК РФ», «ст. 158 ГК РФ»
- Не выдумывай — если информации нет, скажи об этом
- Перед итоговым резюме сверяй цифры (суммы штрафов, сроки) с тем, что уже процитировано в теле ответа — не пересчитывай их заново по памяти
- Slug документов: ${SLUGS_LIST}
- ППВС (Постановления Пленума Верховного Суда) — ссылайся как «пункт 1 ППВС № 17»
`;

function sanitizeInput(text: string): string {
  return text.trim().slice(0, 4096);
}

function validateToolCall(name: string, args: any): any {
  const validated: any = {};
  args = args || {};
  if (name === "search_legal_db") {
    validated.query = String(args.query ?? "").slice(0, 500);
    const topK = parseInt(args.top_k ?? 10, 10);
    validated.top_k = Math.min(Number.isFinite(topK) ? topK : 10, 50);
    const slug = args.doc_slug;
    if (slug && ALLOWED_SLUGS.has(slug)) validated.doc_slug = slug;
  } else if (name === "get_article") {
    const slug = String(args.slug ?? "");
    validated.slug = ALLOWED_SLUGS.has(slug) ? slug : "";
    validated.article_number = String(args.article_number ?? "").slice(0, 50);
  } else if (name === "web_search") {
    validated.query = String(args.query ?? "").slice(0, 500);
  } else if (name === "web_fetch") {
    validated.url = String(args.url ?? "").slice(0, 2000);
  }
  return validated;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeHistory(history: HistoryMessage[]): any[] {
  return history
    .filter((m) => m && typeof m === "object")
    .map((m) => {
      const copy: any = { ...m };
      delete copy.reasoning_content;
      const c = copy.content;
      if (c === undefined) copy.content = null;
      else if (typeof c === "string" && c.length > 20000) {
        copy.content = c.slice(0, 20000) + "\n...(история обрезана)";
      }
      return copy;
    });
}

function minimalMessages(messages: any[]): any[] {
  const minimal = messages.filter((m) => m.role === "system");
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      minimal.push(messages[i]);
      break;
    }
  }
  return minimal.length ? minimal : messages;
}

async function callLLM(messages: any[], toolsEnabled: boolean, llmConfig: LLMConfig): Promise<any> {
  const body: any = {
    model: llmConfig.model,
    messages,
    temperature: 0.3,
    max_tokens: 16384,
    reasoning_effort: "high",
  };
  if (toolsEnabled) {
    body.tools = TOOLS;
    body.tool_choice = "auto";
  }

  const headers = {
    Authorization: `Bearer ${llmConfig.apiKey}`,
    "Content-Type": "application/json",
  };
  const endpoint = `${llmConfig.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  let lastStatus: number | null = null;

  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      const resp = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
      lastStatus = resp.status;
      if (resp.status === 200) {
        return await resp.json();
      }
    } catch {
      // сетевая ошибка — пробуем ещё раз ниже
    }
    if (attempt < RETRIES - 1) {
      await sleep(2 ** attempt * 1000);
    }
  }

  if (lastStatus === 400 || lastStatus === 413) {
    try {
      const minimal = minimalMessages(messages);
      const resp = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ ...body, messages: minimal }) });
      if (resp.ok) return await resp.json();
    } catch {
      // сдаёмся, вернём ошибку ниже
    }
  }

  return { error: "Внутренняя ошибка сервера" };
}

const TOOL_DISPLAY: Record<string, string> = {
  search_legal_db: "Поиск в кодексах",
  get_article: "Чтение статьи",
  web_search: "Поиск в интернете",
  web_fetch: "Загрузка страницы",
};

function formatStep(funcName: string, args: any): string {
  const label = TOOL_DISPLAY[funcName] || funcName;
  if (funcName === "search_legal_db") {
    const target = args.doc_slug ? ` [${args.doc_slug}]` : "";
    return `${label}: «${args.query || ""}»${target}`;
  }
  if (funcName === "get_article") {
    return `${label}: ст. ${args.article_number || ""} (${args.slug || ""})`;
  }
  if (funcName === "web_search") {
    return `${label}: «${(args.query || "").slice(0, 100)}»`;
  }
  if (funcName === "web_fetch") {
    return `${label}: ${(args.url || "").slice(0, 120)}`;
  }
  return `${label}: ${JSON.stringify(args).slice(0, 100)}`;
}

function extractSources(text: string): string[] {
  const sources: string[] = [];
  const seen = new Set<string>();
  const re = /(?:ст(?:атья)?\.?\s*)(\d[\d.]*)\s+([А-ЯЁA-Z]+(?:\s+[А-ЯЁA-Z]+){0,3})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const key = `ст. ${m[1]} ${m[2].trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      sources.push(key);
    }
  }
  return sources;
}

type ToolFn = (args: any, llmConfig: LLMConfig) => Promise<string>;

const TOOL_MAP: Record<string, ToolFn> = {
  search_legal_db: (args) => searchLegalDb(args.query, args.top_k, args.doc_slug),
  get_article: (args) => getArticle(args.slug, args.article_number),
  web_search: (args, llmConfig) => webSearch(args.query, llmConfig.model),
  web_fetch: (args) => webFetch(args.url),
};

export interface AgentResult {
  answer: string;
  sources: string[];
  history: HistoryMessage[];
  thoughts: string[];
}

export async function runAgent(
  userQuery: string,
  messagesHistory: HistoryMessage[] | null | undefined,
  llmConfig: LLMConfig,
  onProgress?: (step: string) => void
): Promise<AgentResult> {
  const query = sanitizeInput(userQuery);

  const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }];
  if (messagesHistory && messagesHistory.length) {
    messages.push(...sanitizeHistory(messagesHistory));
  }
  messages.push({ role: "user", content: query });

  const thoughts: string[] = [];
  let totalTokens = 0;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await callLLM(messages, true, llmConfig);

    if (response.error) {
      return { answer: `⚠️ Ошибка AI: ${response.error}`, sources: [], history: messages.slice(1), thoughts };
    }
    if (!response.choices || !response.choices.length) {
      return { answer: "⚠️ Пустой ответ от AI", sources: [], history: messages.slice(1), thoughts };
    }

    const choice = response.choices[0];
    const message = choice.message || {};

    const usage = response.usage || {};
    totalTokens += usage.total_tokens || 0;
    if (totalTokens > MAX_TOTAL_TOKENS) {
      const resultText = message.content || "";
      if (resultText) {
        messages.push({ role: "assistant", content: resultText });
        return { answer: resultText, sources: extractSources(resultText), history: messages.slice(1), thoughts };
      }
      return {
        answer: "⚠️ Достигнут лимит стоимости обработки. Попробуй сократить вопрос.",
        sources: [],
        history: messages.slice(1),
        thoughts,
      };
    }

    const toolCalls = message.tool_calls;
    if (!toolCalls || !toolCalls.length) {
      const content = message.content || "";
      if (!content) {
        return { answer: "(пустой ответ)", sources: [], history: messages.slice(1), thoughts };
      }
      messages.push({ role: "assistant", content });
      return { answer: content, sources: extractSources(content), history: messages.slice(1), thoughts };
    }

    const intermediateText: string = message.content || "";
    if (intermediateText.trim()) {
      const step = `Обдумываю: ${intermediateText.slice(0, 300).trim()}`;
      thoughts.push(step);
      onProgress?.(step);
    }

    const assistantMsg: any = { role: "assistant", content: message.content || null };
    if (message.tool_calls) assistantMsg.tool_calls = message.tool_calls;
    messages.push(assistantMsg);

    for (const tc of toolCalls) {
      const funcName = tc.function?.name;
      let rawArgs: any = {};
      try {
        rawArgs = JSON.parse(tc.function?.arguments || "{}");
      } catch {
        rawArgs = {};
      }
      const args = validateToolCall(funcName, rawArgs);

      const step = formatStep(funcName, args);
      thoughts.push(step);
      onProgress?.(step);

      const fn = TOOL_MAP[funcName];
      const result = fn ? await fn(args, llmConfig) : JSON.stringify({ error: `Unknown tool: ${funcName}` });

      messages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
  }

  return {
    answer: "Превышено количество итераций. Попробуй переформулировать вопрос конкретнее.",
    sources: [],
    history: messages.slice(1),
    thoughts,
  };
}
