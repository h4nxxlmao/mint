import type { ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";
import { highlightCode } from "@/lib/highlight";

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textFromNode((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

function languageFromNode(node: ReactNode): string | undefined {
  if (!node || typeof node !== "object" || !("props" in node)) return undefined;
  const props = (node as { props?: { className?: string; "data-language"?: string } }).props;
  if (props?.["data-language"]) return props["data-language"];
  const match = /language-([A-Za-z0-9_-]+)/.exec(props?.className ?? "");
  return match?.[1];
}

export async function HighlightedPre({ children }: { children?: ReactNode }) {
  const code = textFromNode(children).replace(/\n$/, "");
  const language = languageFromNode(children);
  const html = await highlightCode(code, language);
  const focusableHtml = html.replace("<pre ", '<pre tabindex="0" ');

  return (
    <div className="code-frame">
      <CopyButton value={code} label="Copy code" iconOnly className="code-copy" />
      <div dangerouslySetInnerHTML={{ __html: focusableHtml }} />
    </div>
  );
}
