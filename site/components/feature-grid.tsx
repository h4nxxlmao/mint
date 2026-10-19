import { BookOpen, Fingerprint, GitBranch, Package, Scale, Terminal, WifiOff, Workflow } from "lucide-react";
import Link from "next/link";
import CountUp from "@/components/reactbits/CountUp/CountUp";
import SpotlightCard from "@/components/reactbits/SpotlightCard/SpotlightCard";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

function CardTitle({ icon: Icon, children }: { icon: typeof Fingerprint; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-background/70 text-mint">
        <Icon className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold tracking-[-0.015em] text-foreground">{children}</h3>
    </div>
  );
}

function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("mt-3 text-sm leading-6 text-muted", className)}>{children}</p>;
}

const cardProps = {
  theme: "dark" as const,
  spotlightColor: "#8df0c3",
  intensity: 0.14,
  spotlightSize: 280,
  borderGlow: 0.75,
  proximity: 100,
  grain: 0.035,
  className: "spotlight-card",
};

export function FeatureGrid() {
  return (
    <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-12">
      <SpotlightCard {...cardProps} className="spotlight-card md:col-span-6">
        <div className="flex h-full min-h-[15rem] flex-col justify-between">
          <div>
            <CardTitle icon={Fingerprint}>CSPRNG only</CardTitle>
            <CardBody>
              Every byte comes from node:crypto. No Math.random, no clock fallback, no seeded state to leak.
            </CardBody>
          </div>
          <div className="mt-6 overflow-hidden rounded-lg border border-line bg-background/80">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="font-mono text-[0.62rem] text-subtle">src/random.ts</span>
              <span className="font-mono text-[0.6rem] text-mint">crypto</span>
            </div>
            <pre className="overflow-x-auto p-3 font-mono text-[0.68rem] leading-6 text-muted">
              <code>
                <span className="text-subtle">const</span> bytes ={" "}
                <span className="text-mint">randomBytes</span>(<span className="text-warning">32</span>);
                {"\n"}
                <span className="text-subtle">{"// 256 bits, straight from the CSPRNG"}</span>
              </code>
            </pre>
          </div>
        </div>
      </SpotlightCard>

      <SpotlightCard {...cardProps} className="spotlight-card md:col-span-3">
        <div className="flex h-full min-h-[15rem] flex-col justify-between">
          <div>
            <CardTitle icon={Package}>Zero dependencies</CardTitle>
            <CardBody>Nothing added to your node_modules tree.</CardBody>
          </div>
          <div className="mt-6">
            <p className="tabular text-5xl font-semibold tracking-[-0.06em] text-mint">
              <CountUp to={0} duration={0.8} />
            </p>
            <p className="mt-1 font-mono text-[0.64rem] text-subtle">runtime packages</p>
          </div>
        </div>
      </SpotlightCard>

      <SpotlightCard {...cardProps} className="spotlight-card md:col-span-3">
        <div className="flex h-full min-h-[15rem] flex-col justify-between">
          <div>
            <CardTitle icon={Terminal}>39 generators</CardTitle>
            <CardBody>From raw bytes to TypeIDs, all with the same flags.</CardBody>
          </div>
          <div className="mt-6 flex items-end justify-between gap-2">
            <p className="tabular text-5xl font-semibold tracking-[-0.06em] text-foreground">
              <CountUp to={site.generatorCount} duration={1.2} />
            </p>
            <span className="pb-1 font-mono text-[0.62rem] text-subtle">mint &lt;n&gt;</span>
          </div>
        </div>
      </SpotlightCard>

      <SpotlightCard {...cardProps} className="spotlight-card md:col-span-4">
        <div className="flex h-full min-h-[13rem] flex-col justify-between">
          <div>
            <CardTitle icon={Scale}>Bias-free sampling</CardTitle>
            <CardBody>Rejection sampling for characters, integers and shuffles. No modulo shortcuts.</CardBody>
          </div>
          <div className="mt-6 flex flex-wrap gap-1.5" aria-hidden="true">
            {["a", "Q", "7", "z", "2", "M", "x", "9", "k", "V", "+", "r"].map((char, index) => (
              <span
                key={`${char}-${index}`}
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded border font-mono text-[0.65rem]",
                  index === 4
                    ? "border-mint/40 bg-mint/10 text-mint"
                    : "border-line bg-background/70 text-subtle",
                )}
              >
                {char}
              </span>
            ))}
          </div>
        </div>
      </SpotlightCard>

      <SpotlightCard {...cardProps} className="spotlight-card md:col-span-4">
        <div className="flex h-full min-h-[13rem] flex-col justify-between">
          <div>
            <CardTitle icon={WifiOff}>Offline, always</CardTitle>
            <CardBody>No network calls, telemetry or update checks. It works on a plane.</CardBody>
          </div>
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-line bg-background/70 px-3 py-2">
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-mint/30" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-mint" />
            </span>
            <span className="font-mono text-[0.65rem] text-muted">network: disabled</span>
          </div>
        </div>
      </SpotlightCard>

      <SpotlightCard {...cardProps} className="spotlight-card md:col-span-4">
        <div className="flex h-full min-h-[13rem] flex-col justify-between">
          <div>
            <CardTitle icon={Workflow}>Pipe-friendly</CardTitle>
            <CardBody>One value on stdout. JSON when you need structure. Color only on a TTY.</CardBody>
          </div>
          <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-background/70 px-3 py-2.5">
            <code className="whitespace-nowrap font-mono text-[0.65rem] text-muted">
              mint token --bytes 32 <span className="text-subtle">|</span> pbcopy
            </code>
          </div>
        </div>
      </SpotlightCard>

      <SpotlightCard {...cardProps} className="spotlight-card md:col-span-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-background/70 text-mint">
              <BookOpen className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-foreground">MIT, open source</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
                Read the sampling code, audit the scanner rules, or add a generator. The source is the documentation.
              </p>
            </div>
          </div>
          <Link
            href={site.github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line px-3.5 py-2 font-mono text-xs text-foreground transition-colors hover:border-mint/40 hover:text-mint"
          >
            <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
            h4nxxlmao/mint
          </Link>
        </div>
      </SpotlightCard>
    </div>
  );
}
