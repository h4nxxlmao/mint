import { ChevronDown } from "lucide-react";
import type { TocEntry } from "@/lib/docs";

function TocLinks({ toc }: { toc: TocEntry[] }) {
  if (toc.length === 0) return null;
  return (
    <nav aria-label="On this page" className="doc-toc">
      {toc.map((entry) => (
        <a key={`${entry.title}-${entry.id}`} href={`#${entry.id}`} data-depth={entry.depth}>
          {entry.title}
        </a>
      ))}
    </nav>
  );
}

export function DocsTocMobile({ toc }: { toc: TocEntry[] }) {
  if (toc.length === 0) return null;
  return (
    <details className="mb-7 rounded-xl border border-line bg-surface/50 xl:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        On this page
        <ChevronDown className="h-4 w-4 text-subtle" aria-hidden="true" />
      </summary>
      <div className="border-t border-line px-3 py-3">
        <TocLinks toc={toc} />
      </div>
    </details>
  );
}

export function DocsTocDesktop({ toc }: { toc: TocEntry[] }) {
  return (
    <aside className="hidden xl:block">
      <div className="sticky top-24">
        <p className="mono-label mb-3">On this page</p>
        <TocLinks toc={toc} />
      </div>
    </aside>
  );
}
