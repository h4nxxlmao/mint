"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { site } from "@/lib/site";

export function HeroInstall() {
  return (
    <div className="mt-6">
      <div className="flex max-w-xl items-center gap-2 rounded-xl border border-line bg-raised p-1.5 pl-3">
        <span aria-hidden="true" className="font-mono text-xs text-mint">
          $
        </span>
        <code className="install-command min-w-0 flex-1 font-mono text-[0.76rem] leading-5 text-foreground sm:text-sm">
          {site.install}
        </code>
        <CopyButton value={site.install} label="Copy install command" className="shrink-0" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Link
          href="/docs/getting-started"
          className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-mint px-4 text-sm font-semibold text-ink transition-colors hover:bg-mint-strong active:translate-y-px"
        >
          Read the docs
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <a
          href={site.github}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:border-mint/35 hover:bg-raised active:translate-y-px"
        >
          GitHub
          <ArrowUpRight className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <a
          href={site.npm}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:border-mint/35 hover:bg-raised active:translate-y-px"
        >
          npm
          <ArrowUpRight className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </div>
  );
}
