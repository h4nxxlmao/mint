import type { ReactNode } from "react";
import { slugifyHeading } from "@/lib/utils";

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textFromNode((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

export function MdxHeading({ level, children }: { level: 2 | 3; children: ReactNode }) {
  const text = textFromNode(children).trim();
  const id = slugifyHeading(text);
  const Heading = level === 2 ? "h2" : "h3";

  return (
    <Heading id={id} className="group/heading">
      {children}
      <a
        href={`#${id}`}
        aria-label={`Link to ${text}`}
        className="ml-2 inline-block text-mint/0 no-underline transition-colors group-hover/heading:text-mint/60 focus-visible:text-mint"
      >
        #
      </a>
    </Heading>
  );
}
