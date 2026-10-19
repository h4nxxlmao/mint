import type { Metadata } from "next";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { PlaygroundLoader } from "@/components/playground/playground-loader";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Playground",
  description:
    "Generate secure secrets and IDs, or scan text for leaked credentials, entirely in your browser. Nothing is uploaded.",
  alternates: { canonical: "/playground" },
  openGraph: {
    title: "mint playground",
    description:
      "Generate cryptographically secure values and scan text for leaked credentials in your browser. Nothing leaves the tab.",
    url: `${site.url}/playground`,
  },
};

export default function PlaygroundPage() {
  return (
    <div className="section-tight">
      <div className="wrap">
        <div className="max-w-3xl">
          <p className="eyebrow-line">Playground</p>
          <h1 className="mt-4 text-balance text-[clamp(2.6rem,6vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.055em]">
            Generate. Scan. Nothing leaves this tab.
          </h1>
          <p className="mt-5 max-w-[60ch] text-pretty text-base leading-7 text-muted md:text-lg">
            A browser-sized version of mint and mint guard. Web Crypto does the generating, the scanner works on the
            text you paste, and there is no server round trip.
          </p>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface/70 px-3 py-2 font-mono text-[0.68rem] text-muted">
            <LockKeyhole className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
            crypto.getRandomValues only
          </span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface/70 px-3 py-2 font-mono text-[0.68rem] text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
            no uploads, no tracking
          </span>
        </div>

        <div className="mt-10">
          <PlaygroundLoader />
        </div>

        <p className="mt-6 max-w-3xl text-xs leading-5 text-subtle">
          The playground is a compact, client-side subset. The CLI is the source of truth for exact flags and output
          formats. For anything real, rotate exposed credentials first, then use the CLI&apos;s guard scan and baseline
          flow.
        </p>
      </div>
    </div>
  );
}
