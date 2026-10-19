import { FileCode2, GitCommitHorizontal, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { StaticCode } from "@/components/static-code";
import { site } from "@/lib/site";

const findings = [
  {
    severity: "critical",
    file: "src/lib/stripe.ts",
    line: 21,
    rule: "Stripe secret key",
    preview: "sk_l...Xq",
    fix: "mint apikey --prefix sk_live_ --length 32 --checksum",
  },
  {
    severity: "high",
    file: ".env.local",
    line: 4,
    rule: "GitHub token",
    preview: "ghp_...9f",
    fix: "mint token --bytes 32",
  },
  {
    severity: "medium",
    file: "scripts/publish.ts",
    line: 8,
    rule: "Hard-coded credential",
    preview: "n4...Qz",
    fix: "mint password --length 32 --no-ambiguous",
  },
];

const severityStyles: Record<string, string> = {
  critical: "text-danger",
  high: "text-warning",
  medium: "text-info",
};

const hook = `# .git/hooks/pre-commit
mint guard scan --staged --fail-on medium`;

const ci = `- run: npx @xnah/mint guard scan --fail-on high --format sarif > mintguard.sarif
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: mintguard.sarif`;

export async function GuardReportPreview() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.15fr] lg:items-start">
      <div className="min-w-0">
        <p className="text-base leading-7 text-muted">
          mint guard scans a working tree, the git index or an entire history for credentials. It never sends data
          anywhere, never edits a file and never prints the full value.
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line bg-surface/80 p-4">
            <ShieldAlert className="h-4 w-4 text-mint" strokeWidth={1.6} aria-hidden="true" />
            <p className="mt-3 tabular text-2xl font-semibold text-foreground">{site.guardRuleCount}</p>
            <p className="mt-1 text-xs text-subtle">built-in rules</p>
          </div>
          <div className="rounded-xl border border-line bg-surface/80 p-4">
            <FileCode2 className="h-4 w-4 text-mint" strokeWidth={1.6} aria-hidden="true" />
            <p className="mt-3 tabular text-2xl font-semibold text-foreground">4</p>
            <p className="mt-1 text-xs text-subtle">report formats</p>
          </div>
        </div>

        <div className="mt-7">
          <p className="mono-label">Detects</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "Cloud keys",
              "Source-host tokens",
              "AI provider keys",
              "Private key blocks",
              "Database URLs",
              "JWTs",
              "Hard-coded credentials",
              ".env hygiene",
            ].map((item) => (
              <span
                key={item}
                className="rounded-md border border-line bg-surface px-2.5 py-1 font-mono text-[0.66rem] text-muted"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-2.5">
          <Link
            href="/docs/guard-scan"
            className="inline-flex h-11 items-center rounded-lg bg-mint px-4 text-sm font-semibold text-ink transition-colors hover:bg-mint-strong active:translate-y-px"
          >
            How mint guard works
          </Link>
          <a
            href={site.github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-mint/35"
          >
            <GitCommitHorizontal className="h-4 w-4 text-subtle" aria-hidden="true" />
            View the rules
            <span className="sr-only"> on GitHub (opens in a new tab)</span>
          </a>
        </div>
      </div>

      <div className="terminal-shadow min-w-0 overflow-hidden rounded-2xl border border-line bg-[#080e0b]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <code className="font-mono text-[0.7rem] text-muted">
            <span className="text-mint">$</span> mint guard scan
          </code>
          <span className="font-mono text-[0.6rem] text-subtle">example report</span>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
            <p className="font-mono text-[0.68rem] text-warning">! 3 findings in 48 files</p>
            <p className="font-mono text-[0.6rem] text-subtle">0.34s</p>
          </div>

          <ul className="divide-y divide-line/70">
            {findings.map((finding) => (
              <li key={finding.file} className="py-3.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.66rem]">
                  <span className={`w-16 uppercase tracking-[0.06em] ${severityStyles[finding.severity]}`}>
                    {finding.severity}
                  </span>
                  <span className="min-w-0 flex-1 break-all text-muted">
                    {finding.file}:{finding.line}
                  </span>
                  <span className="rounded bg-background px-1.5 py-0.5 text-[0.65rem] text-foreground">
                    {finding.preview}
                  </span>
                </div>
                <p className="mt-1.5 pl-[4.75rem] text-xs text-subtle">{finding.rule}</p>
                <p className="mt-1 break-all pl-[4.75rem] font-mono text-[0.61rem] text-mint/80">fix: {finding.fix}</p>
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-line pt-3">
            <p className="font-mono text-[0.61rem] text-subtle">
              Preview only. Values are never printed in full, stored in reports or written to the baseline.
            </p>
          </div>
        </div>
      </div>

      <div className="min-w-0 lg:col-span-2">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-line bg-surface/60 p-4">
            <p className="mono-label">Pre-commit hook</p>
            <StaticCode code={hook} lang="bash" label="Copy pre-commit hook" />
            <p className="mt-2 text-xs leading-5 text-subtle">
              install-hook never clobbers an existing hook unless you pass --force.
            </p>
          </div>
          <div className="min-w-0 rounded-xl border border-line bg-surface/60 p-4">
            <p className="mono-label">GitHub Actions</p>
            <StaticCode code={ci} lang="yaml" label="Copy CI workflow" />
            <p className="mt-2 text-xs leading-5 text-subtle">
              SARIF findings upload to code scanning with redacted previews.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
