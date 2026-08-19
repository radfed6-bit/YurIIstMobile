import { parse } from "node-html-parser";

const STRIP_SELECTORS = "script, style, nav, footer, header, aside, noscript";

/** Грубый аналог BeautifulSoup .get_text(separator="\n", strip=True). */
export function htmlToText(html: string): string {
  const root = parse(html, { blockTextElements: { script: false, style: false, noscript: false } });
  root.querySelectorAll(STRIP_SELECTORS).forEach((el) => el.remove());
  let text = (root.structuredText || root.textContent || "").trim();
  text = text.replace(/\n{3,}/g, "\n\n");
  return text;
}
