import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FaqList } from "@/components/faq-list";
import { FeatureGrid } from "@/components/feature-grid";
import { GenerateTabs } from "@/components/generate-tabs";
import { GuardReportPreview } from "@/components/guard-report-preview";
import { Hero } from "@/components/hero";
import { InstallTabs } from "@/components/install-tabs";
import { PlaygroundTeaser } from "@/components/playground-teaser";
import ShinyText from "@/components/reactbits/ShinyText/ShinyText";
import { SectionHeading } from "@/components/section-heading";
import { StatsStrip } from "@/components/stats-strip";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "mint - secure random secrets and IDs from your terminal",
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: site.url,
    title: "mint - secure random secrets and IDs from your terminal",
    description: site.description,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "mint",
  alternateName: "@xnah/mint",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Node.js 18+",
  softwareVersion: site.version,
  description: site.description,
  license: "https://opensource.org/license/mit",
  codeRepository: site.github,
  downloadUrl: site.npm,
  url: site.url,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  author: {
    "@type": "Person",
    name: "hanx",
    url: site.authorUrl,
  },
  featureList: [
    "Cryptographically secure random generators",
    "39 generator commands",
    "Bias-free rejection sampling",
    "Offline secret scanning with mint guard",
    "JSON, SARIF and Markdown reports",
    "Zero runtime dependencies",
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <StatsStrip />

      <section id="features" className="section">
        <div className="wrap">
          <SectionHeading title="Secure by construction.">
            The only entropy source is node:crypto. The rest is careful sampling, honest entropy math and a CLI that
            gets out of your way.
          </SectionHeading>
          <FeatureGrid />
        </div>
      </section>

      <section id="generate" className="section border-t border-line bg-surface/30">
        <div className="wrap">
          <SectionHeading eyebrow="mint generate" title="One command. Dozens of shapes.">
            Pick a generator, pass a flag, get a value on stdout. The same flag surface works across raw bytes,
            identifiers, passwords and dev keys.
          </SectionHeading>
          <GenerateTabs />
        </div>
      </section>

      <section id="protect" className="section">
        <div className="wrap">
          <SectionHeading
            eyebrow="mint guard"
            title={
              <ShinyText
                text="Protect what you ship."
                color="#edf6f0"
                shineColor="#8df0c3"
                speed={4}
                angle={115}
                shineWidth={28}
                softness={0.9}
                trigger="view"
                className="align-baseline"
              />
            }
          >
            Find leaked secrets before they leave your machine. Offline, redacted by default, and ready for a
            pre-commit hook or CI.
          </SectionHeading>
          <div className="mt-10">
            <GuardReportPreview />
          </div>
        </div>
      </section>

      <section id="playground" className="section-tight border-y border-line bg-surface/20">
        <div className="wrap">
          <PlaygroundTeaser />
        </div>
      </section>

      <section id="install" className="section">
        <div className="wrap grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <SectionHeading title="Install once. Use everywhere.">
            Install it globally, run it with npx, or add it to a project. The binary is called mint; the package is{" "}
            <code className="font-mono text-mint">{site.packageName}</code>.
          </SectionHeading>
          <div>
            <InstallTabs />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <a
                href={site.npm}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/70 px-4 py-3 text-sm text-foreground transition-colors hover:border-mint/35"
              >
                <span>Package on npm</span>
                <ArrowUpRight className="h-4 w-4 text-subtle" aria-hidden="true" />
              </a>
              <a
                href={site.github}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/70 px-4 py-3 text-sm text-foreground transition-colors hover:border-mint/35"
              >
                <span>Source on GitHub</span>
                <ArrowUpRight className="h-4 w-4 text-subtle" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="section border-t border-line">
        <div className="wrap grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
          <div>
            <SectionHeading title="Questions, answered.">
              A few things people ask before they pipe it into a production secret manager.
            </SectionHeading>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link href="/docs/faq" className="text-sm text-mint hover:underline">
                Read the full FAQ
              </Link>
              <a
                href={site.githubIssues}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
              >
                Open an issue
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          </div>
          <FaqList />
        </div>
      </section>
    </>
  );
}
