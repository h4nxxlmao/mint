import { ArrowUpRight, Check, Code2, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";

const features = [
  { icon: Code2, text: "39 generators" },
  { icon: ShieldCheck, text: "client-side guard scan" },
  { icon: Sparkles, text: "entropy readout" },
  { icon: Check, text: "no uploads" },
];

export function PlaygroundTeaser() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface/75">
      <div className="dot-grid absolute inset-y-0 right-0 hidden w-1/2 opacity-25 md:block" aria-hidden="true" />
      <div className="relative grid gap-8 p-6 sm:p-8 md:grid-cols-[1fr_0.9fr] md:items-center md:p-10">
        <div>
          <p className="eyebrow-line">Playground</p>
          <h2 className="mt-3 max-w-xl text-balance text-3xl font-semibold tracking-[-0.04em] md:text-4xl">
            Try it without installing anything.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted">
            Generate values and scan pasted code in the browser. Web Crypto does the work, and nothing leaves the tab.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {features.map(({ icon: Icon, text }) => (
              <span key={text} className="inline-flex items-center gap-1.5 font-mono text-[0.68rem] text-subtle">
                <Icon className="h-3.5 w-3.5 text-mint/80" aria-hidden="true" />
                {text}
              </span>
            ))}
          </div>
          <Link
            href="/playground"
            className="mt-7 inline-flex h-11 items-center gap-1.5 rounded-lg bg-mint px-4 text-sm font-semibold text-ink transition-colors hover:bg-mint-strong active:translate-y-px"
          >
            Open the playground
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="rounded-xl border border-line bg-background/90 p-4">
          <div className="flex items-center justify-between gap-3">
            <code className="font-mono text-[0.7rem] text-mint">mint nanoid --size 12</code>
            <CopyButton value="mint nanoid --size 12" iconOnly label="Copy command" />
          </div>
          <div className="mt-3 rounded-lg border border-line bg-surface/60 px-3 py-4">
            <p className="break-all font-mono text-lg tracking-[-0.02em] text-foreground">gkP2vci-kG7f</p>
            <p className="mt-3 font-mono text-[0.62rem] text-subtle">72 bits · URL-safe · 64-symbol alphabet</p>
          </div>
          <div className="mt-3 flex items-center gap-2 font-mono text-[0.62rem] text-subtle">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" aria-hidden="true" />
            generated locally with crypto.getRandomValues
          </div>
        </div>
      </div>
    </div>
  );
}
