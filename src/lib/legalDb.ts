import { getDb } from "./database";

// Тот же список стоп-слов, что и в исходном src/tools.py, для очистки
// FTS5-запроса при фолбэке на OR-поиск по ключевым словам.
const STOP_WORDS = new Set([
  "какое", "какой", "какая", "какие", "какого", "какому", "каким", "каких",
  "что", "кто", "где", "когда", "куда", "откуда", "почему", "зачем", "как",
  "сколько", "чей", "который", "для", "за", "на", "по", "под", "над", "о",
  "об", "от", "до", "из", "у", "при", "с", "со", "в", "во", "к", "ко",
  "а", "но", "и", "или", "да", "же", "бы", "ли", "не", "ни", "нет",
  "это", "этот", "эта", "эти", "этого", "этому", "этим", "этих",
  "тот", "та", "те", "того", "тому", "тем", "тех",
  "весь", "вся", "все", "всего", "всем", "всеми", "всех",
  "быть", "есть", "будет", "можно", "нужно", "надо",
  "является", "называется", "составляет", "предусматривает",
  "меня", "тебя", "его", "её", "ее", "нас", "вас", "их",
  "мне", "тебе", "ему", "нам", "вам", "им",
]);

function extractFtsKeywords(text: string): string {
  const words = text.toLowerCase().match(/[а-яёa-z]+/gi) || [];
  const keywords = words.filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  if (!keywords.length) return text;
  return keywords.slice(0, 15).join(" OR ");
}

function makeFtsQuery(raw: string): string {
  let clean = raw.trim();
  clean = clean.replace(/[.]+/g, " ").replace(/\s+/g, " ");
  if (!clean) return raw;
  const hasOperators = /\b(OR|AND|NOT)\b/i.test(clean);
  if (clean.includes('"') || hasOperators) return clean;
  const words = clean.split(" ");
  if (words.length <= 6) return clean;
  return `"${clean}"`;
}

interface ArticleRow {
  document_id: number;
  article_number: string;
  title: string | null;
  content: string;
  chapter: string | null;
  section: string | null;
  doc_title: string;
  doc_slug: string;
}

export async function searchLegalDb(query: string, topK = 10, docSlug?: string): Promise<string> {
  try {
    const db = await getDb();
    const ftsQuery = makeFtsQuery(query);
    const limit = Math.max(1, Math.min(topK || 10, 50));

    const run = (q: string) => {
      if (docSlug) {
        return db.getAllAsync<ArticleRow>(
          `SELECT a.*, d.title as doc_title, d.slug as doc_slug
           FROM articles_fts
           JOIN articles a ON a.id = articles_fts.rowid
           JOIN documents d ON d.id = a.document_id
           WHERE articles_fts MATCH ? AND d.slug = ?
           ORDER BY rank LIMIT ?`,
          [q, docSlug, limit]
        );
      }
      return db.getAllAsync<ArticleRow>(
        `SELECT a.*, d.title as doc_title, d.slug as doc_slug
         FROM articles_fts
         JOIN articles a ON a.id = articles_fts.rowid
         JOIN documents d ON d.id = a.document_id
         WHERE articles_fts MATCH ?
         ORDER BY rank LIMIT ?`,
        [q, limit]
      );
    };

    let rows = await run(ftsQuery);
    if (!rows.length) {
      const kw = extractFtsKeywords(query);
      if (kw !== ftsQuery) rows = await run(kw);
    }

    const results = rows.map((r) => ({
      document: r.doc_title,
      slug: r.doc_slug,
      article_number: r.article_number,
      title: r.title || "",
      content: (r.content || "").slice(0, 1500),
      chapter: r.chapter || "",
      section: r.section || "",
    }));
    return JSON.stringify(results, null, 2);
  } catch (e) {
    return JSON.stringify({ error: "search_legal_db: internal error" });
  }
}

const articleCache = new Map<string, string>();
const MAX_CACHE = 500;

export async function getArticle(slug: string, articleNumber: string): Promise<string> {
  const cacheKey = `${slug}:${articleNumber}`;
  const cached = articleCache.get(cacheKey);
  if (cached) return cached;

  try {
    const db = await getDb();
    const row = await db.getFirstAsync<ArticleRow>(
      `SELECT a.*, d.title as doc_title, d.slug as doc_slug
       FROM articles a
       JOIN documents d ON d.id = a.document_id
       WHERE d.slug = ? AND a.article_number = ?`,
      [slug, articleNumber]
    );
    if (!row) {
      return JSON.stringify({ error: `Статья ${articleNumber} в ${slug} не найдена` });
    }
    const result = {
      document: row.doc_title,
      slug: row.doc_slug,
      article_number: row.article_number,
      title: row.title || "",
      content: row.content,
      chapter: row.chapter || "",
      section: row.section || "",
    };
    const text = JSON.stringify(result, null, 2);
    if (articleCache.size >= MAX_CACHE) {
      const firstKey = articleCache.keys().next().value;
      if (firstKey !== undefined) articleCache.delete(firstKey);
    }
    articleCache.set(cacheKey, text);
    return text;
  } catch (e) {
    return JSON.stringify({ error: "get_article: internal error" });
  }
}
