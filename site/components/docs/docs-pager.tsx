import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";

export function DocsPager({
  previous,
  next,
}: {
  previous?: { slug: string; title: string };
  next?: { slug: string; title: string };
}) {
  return (
    <nav aria-label="Documentation pagination" className="mt-14 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
      {previous ? (
        <Link
          href={`/docs/${previous.slug}`}
          className="group flex min-h-20 flex-col justify-center rounded-xl border border-line bg-surface/50 px-4 py-3 transition-colors hover:border-mint/30 hover:bg-surface"
        >
          <span className="flex items-center gap-1.5 font-mono text-[0.62rem] text-subtle">
            <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
            Previous
          </span>
          <span className="mt-1 text-sm font-medium text-foreground">{previous.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={`/docs/${next.slug}`}
          className="group flex min-h-20 flex-col items-end justify-center rounded-xl border border-line bg-surface/50 px-4 py-3 text-right transition-colors hover:border-mint/30 hover:bg-surface sm:col-start-2"
        >
          <span className="flex items-center gap-1.5 font-mono text-[0.62rem] text-subtle">
            Next
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
          <span className="mt-1 text-sm font-medium text-foreground">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}
