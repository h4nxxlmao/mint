import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Terminal } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFoundPage() {
  return (
    <div className="section">
      <div className="wrap">
        <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-surface/70 p-7 sm:p-10">
          <div className="flex items-center gap-2 font-mono text-[0.68rem] text-subtle">
            <Terminal className="h-4 w-4 text-mint" aria-hidden="true" />
            404
          </div>
          <h1 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            That command does not exist.
          </h1>
          <p className="mt-4 max-w-[52ch] text-sm leading-7 text-muted">
            The page is gone or the URL has a typo. Try the docs, or head back to the homepage and mint something
            useful.
          </p>
          <code className="mt-6 block rounded-lg border border-line bg-background px-4 py-3 font-mono text-xs text-muted">
            <span className="text-mint">$</span> mint --help
          </code>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-mint px-4 text-sm font-semibold text-ink transition-colors hover:bg-mint-strong"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back home
            </Link>
            <Link
              href="/docs/getting-started"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-mint/35"
            >
              Read the docs
              <ArrowUpRight className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
