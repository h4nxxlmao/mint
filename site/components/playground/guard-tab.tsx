"use client";

import { CheckCircle2, ClipboardPaste, Eraser, ShieldAlert, ShieldCheck } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import {
  PLAYGROUND_RULE_COUNT,
  redactLine,
  scanText,
  type GuardFinding,
  type Severity,
} from "@/lib/guard";
import { CHARSET_PRESETS, sampleChars } from "@/lib/playground";
import { cn } from "@/lib/utils";

const ALNUM = CHARSET_PRESETS.alnum;
const UPPER_NUMBERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const BASE64 = `${ALNUM}+/`;
const URL_SAFE = CHARSET_PRESETS["url-safe"];

const severityStyles: Record<Severity, string> = {
  critical: "border-danger/30 bg-danger/10 text-danger",
  high: "border-warning/30 bg-warning/10 text-warning",
  medium: "border-info/30 bg-info/10 text-info",
  low: "border-line bg-surface text-muted",
};

function exampleGithubToken() {
  return ["ghp_", "DEMO", sampleChars(36, ALNUM)].join("");
}

function exampleStripeKey() {
  return ["sk_", "live_", "DEMO", sampleChars(24, ALNUM)].join("");
}

function exampleOpenAiKey() {
  return ["sk-", "proj-", "DEMO", sampleChars(32, ALNUM)].join("");
}

function exampleAwsKeyId() {
  return ["AKIA", sampleChars(16, UPPER_NUMBERS)].join("");
}

function exampleAwsSecret() {
  return sampleChars(40, BASE64);
}

function exampleJwt() {
  return [
    ["eyJ", sampleChars(20, URL_SAFE)].join(""),
    ["eyJ", sampleChars(24, URL_SAFE)].join(""),
    sampleChars(32, URL_SAFE),
  ].join(".");
}

function exampleSlackWebhook() {
  return (
    "https://hooks.slack.com/services/" +
    [
      ["T", sampleChars(8, UPPER_NUMBERS)].join(""),
      ["B", sampleChars(8, UPPER_NUMBERS)].join(""),
      sampleChars(24, ALNUM),
    ].join("/")
  );
}

function examplePrivateKey() {
  const header = ["-----BEGIN ", "RSA ", "PRIVATE KEY-----"].join("");
  const footer = ["-----END ", "RSA ", "PRIVATE KEY-----"].join("");
  const body = sampleChars(64, BASE64);
  return `${header}\n${body}\n${footer}`;
}

function buildEnvExample() {
  return [
    "# Fake values, assembled in your browser",
    ["GITHUB_TOKEN=", exampleGithubToken()].join(""),
    ["STRIPE_SECRET_KEY=", exampleStripeKey()].join(""),
    ["OPENAI_API_KEY=", exampleOpenAiKey()].join(""),
    ["SENTRY_AUTH_TOKEN=", sampleChars(32, ALNUM)].join(""),
    ["DATABASE_URL=", "postgres://app:", sampleChars(18, ALNUM), "@db.internal:5432/app"].join(""),
  ].join("\n");
}

function buildSourceExample() {
  const dbValue = sampleChars(24, ALNUM);
  const clientValue = sampleChars(36, ALNUM);
  return [
    "// Fake values, assembled in your browser",
    "export const githubToken = '" + exampleGithubToken() + "';",
    "export const jwt = '" + exampleJwt() + "';",
    "",
    "export function connect() {",
    "  const dbPassword = '" + dbValue + "';",
    "  const clientSecret = '" + clientValue + "';",
    "  return { dbPassword, clientSecret };",
    "}",
    "",
    examplePrivateKey(),
  ].join("\n");
}

function buildCiExample() {
  return [
    "# Fake values, assembled in your browser",
    "env:",
    ["  AWS_ACCESS_KEY_ID: ", exampleAwsKeyId()].join(""),
    ["  AWS_SECRET_ACCESS_KEY: ", exampleAwsSecret()].join(""),
    ["  SLACK_WEBHOOK_URL: ", exampleSlackWebhook()].join(""),
    ["  NPM_TOKEN: ", "npm_", sampleChars(36, ALNUM)].join(""),
  ].join("\n");
}

const examples = [
  { id: "env", label: ".env", build: buildEnvExample },
  { id: "source", label: "source.ts", build: buildSourceExample },
  { id: "ci", label: "deploy.yml", build: buildCiExample },
] as const;

function severityCounts(findings: readonly GuardFinding[]) {
  return {
    critical: findings.filter((finding) => finding.severity === "critical").length,
    high: findings.filter((finding) => finding.severity === "high").length,
    medium: findings.filter((finding) => finding.severity === "medium").length,
  };
}

export function GuardTab() {
  const [text, setText] = useState("");
  const deferredText = useDeferredValue(text);
  const result = useMemo(() => scanText(deferredText), [deferredText]);
  const lines = useMemo(() => deferredText.split(/\r?\n/), [deferredText]);
  const counts = severityCounts(result.findings);
  const pending = deferredText !== text;

  const byLine = useMemo(() => {
    const grouped = new Map<number, GuardFinding[]>();
    for (const finding of result.findings) {
      const current = grouped.get(finding.line) ?? [];
      current.push(finding);
      grouped.set(finding.line, current);
    }
    return [...grouped.entries()].sort((left, right) => left[0] - right[0]);
  }, [result.findings]);

  const loadExample = (build: () => string) => setText(build());

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="min-w-0 rounded-2xl border border-line bg-surface/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Scan text</h2>
            <p className="mt-1 text-xs text-subtle">Paste a .env file, source snippet or CI config.</p>
          </div>
          <div className="flex items-center gap-1.5">
            {examples.map((example) => (
              <button
                key={example.id}
                type="button"
                onClick={() => loadExample(example.build)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-background px-2 font-mono text-[0.62rem] text-muted transition-colors hover:border-mint/35 hover:text-foreground"
              >
                <ClipboardPaste className="h-3 w-3" aria-hidden="true" />
                {example.label}
              </button>
            ))}
          </div>
        </div>

        <label htmlFor="guard-input" className="mt-5 block text-xs font-medium text-muted">
          Text to scan
        </label>
        <textarea
          id="guard-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={200_000}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={"STRIPE_SECRET_KEY=sk_live_...\nDATABASE_URL=postgres://app:...@db.internal:5432/app"}
          className="playground-textarea mt-2 w-full rounded-xl border border-line bg-background p-3 text-foreground transition-colors placeholder:text-subtle focus:border-mint/60"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-[0.62rem] text-subtle">
            {text.length.toLocaleString()} characters · {result.scannedLines} lines
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setText("")}
              disabled={text.length === 0}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-background px-2.5 font-mono text-[0.65rem] text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Eraser className="h-3 w-3" aria-hidden="true" />
              Clear
            </button>
            <span className="font-mono text-[0.62rem] text-subtle" aria-live="polite">
              {pending ? "scanning..." : `scanned in ${result.elapsedMs.toFixed(1)}ms`}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-background/70 p-3">
          <p className="text-[0.68rem] leading-5 text-subtle">
            This demo runs {PLAYGROUND_RULE_COUNT} pattern rules plus a Shannon entropy check. The full CLI has 32
            rules, git history scanning, baselines and SARIF output. Values are fake and assembled in your browser.
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="overflow-hidden rounded-2xl border border-line bg-[#080e0b]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <span className="font-mono text-[0.68rem] text-mint">mint guard</span>
            <span className="font-mono text-[0.6rem] text-subtle">client-side scan</span>
          </div>

          <div className="p-4">
            {text.trim() === "" ? (
              <div className="flex min-h-[16rem] flex-col items-center justify-center text-center">
                <ShieldCheck className="h-7 w-7 text-mint/70" strokeWidth={1.5} aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-foreground">Nothing to scan yet</p>
                <p className="mt-1 max-w-[34ch] text-xs leading-5 text-subtle">
                  Load one of the examples or paste a file. Findings will show a redacted preview and a replacement
                  command.
                </p>
              </div>
            ) : result.findings.length === 0 ? (
              <div className="flex min-h-[16rem] flex-col items-center justify-center text-center">
                <CheckCircle2 className="h-7 w-7 text-mint" strokeWidth={1.5} aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-foreground">No obvious leaks</p>
                <p className="mt-1 max-w-[38ch] text-xs leading-5 text-subtle">
                  This quick scan found nothing. It is a subset, not a guarantee. Rotate anything that was ever
                  committed.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
                  <span className="font-mono text-[0.72rem] text-danger">
                    ! {result.findings.length} finding{result.findings.length === 1 ? "" : "s"}
                  </span>
                  {(["critical", "high", "medium"] as const).map((severity) =>
                    counts[severity] > 0 ? (
                      <span
                        key={severity}
                        className={cn(
                          "rounded border px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.06em]",
                          severityStyles[severity],
                        )}
                      >
                        {counts[severity]} {severity}
                      </span>
                    ) : null,
                  )}
                </div>

                <div className="mt-3 max-h-[18rem] overflow-auto rounded-lg border border-line bg-background/70 p-2">
                  {byLine.slice(0, 30).map(([lineNumber, findings]) => {
                    const line = lines[lineNumber - 1] ?? "";
                    const segments = redactLine(line, findings);
                    return (
                      <div key={lineNumber} className="guard-line" data-hit="true">
                        <span className="select-none text-right text-[0.62rem] text-subtle">{lineNumber}</span>
                        <span>
                          {segments.map((segment, index) =>
                            segment.redacted ? (
                              <span key={index} className="guard-redacted">
                                {segment.text}
                              </span>
                            ) : (
                              <span key={index}>{segment.text}</span>
                            ),
                          )}
                        </span>
                      </div>
                    );
                  })}
                  {byLine.length > 30 ? (
                    <p className="px-2 py-2 text-[0.62rem] text-subtle">Showing the first 30 affected lines.</p>
                  ) : null}
                </div>

                <div className="mt-4 max-h-[28rem] space-y-2.5 overflow-auto pr-1">
                  {result.findings.map((finding, index) => (
                    <div key={`${finding.ruleId}-${finding.line}-${index}`} className="rounded-lg border border-line bg-surface/70 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded border px-1.5 py-0.5 font-mono text-[0.57rem] uppercase tracking-[0.06em]",
                            severityStyles[finding.severity],
                          )}
                        >
                          {finding.severity}
                        </span>
                        <span className="text-xs font-medium text-foreground">{finding.ruleName}</span>
                        <span className="font-mono text-[0.62rem] text-subtle">line {finding.line}</span>
                        <span className="ml-auto rounded bg-background px-1.5 py-0.5 font-mono text-[0.62rem] text-muted">
                          {finding.preview}
                        </span>
                      </div>
                      <p className="mt-2 text-[0.7rem] leading-5 text-muted">{finding.why}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[0.62rem] text-mint">
                          {finding.mintCommand}
                        </code>
                        <CopyButton value={finding.mintCommand} iconOnly label="Copy replacement command" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-line px-4 py-3">
            <ShieldAlert className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
            <p className="font-mono text-[0.6rem] text-subtle">
              previews only · raw matches never enter the findings list
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-line bg-surface/50 p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint" aria-hidden="true" />
          <p className="text-[0.68rem] leading-5 text-subtle">
            For a real project, run <code className="font-mono text-muted">mint guard scan</code> locally and rotate
            first. Deleting a line does not undo a push.
          </p>
        </div>
      </div>
    </div>
  );
}
