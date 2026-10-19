import { createHighlighter, type Highlighter } from "shiki";

const THEME = "github-dark-default";
const LANGUAGES = ["bash", "json", "yaml", "javascript", "typescript", "tsx", "markdown", "text", "sql"] as const;

let highlighterPromise: Promise<Highlighter> | undefined;

function highlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [THEME],
    langs: [...LANGUAGES],
  });
  return highlighterPromise;
}

function normalizeLanguage(language: string | undefined): string {
  switch (language) {
    case "console":
    case "sh":
    case "shell":
      return "bash";
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "md":
      return "markdown";
    case undefined:
    case "":
      return "text";
    default:
      return (LANGUAGES as readonly string[]).includes(language) ? language : "text";
  }
}

export async function highlightCode(code: string, language?: string): Promise<string> {
  const hl = await highlighter();
  const lang = normalizeLanguage(language);
  return hl.codeToHtml(code.replace(/\n$/, ""), {
    lang,
    theme: THEME,
  });
}
