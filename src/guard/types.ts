import type { Flags } from '../flags.js';
import type { Palette } from '../colors.js';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

/** Ordered most severe first; also the report order. */
export const SEVERITIES: readonly Severity[] = ['critical', 'high', 'medium', 'low'];

export function severityRank(severity: Severity): number {
  return SEVERITIES.length - 1 - SEVERITIES.indexOf(severity);
}

export function isSeverity(value: string): value is Severity {
  return (SEVERITIES as readonly string[]).includes(value);
}

export interface RotationAdvice {
  provider: string;
  steps: readonly string[];
  links?: readonly string[];
}

export interface Rule {
  id: string;
  name: string;
  /** Regex source, compiled with the `g` flag (plus `flags` when given). */
  regex: string;
  /** Extra regex flags; must not replace `g`. Defaults to `gu`. */
  flags?: string;
  severity: Severity;
  /** Case-insensitive substrings that must appear in the line before the regex runs. */
  keywords?: readonly string[];
  /** Substrings that must appear somewhere in the file (whole-file rules only). */
  requires?: readonly string[];
  /** Capture group holding the secret itself; defaults to the whole match. */
  capture?: number;
  /** One sentence on why this matters. */
  why: string;
  /** The mint invocation that produces a replacement value. */
  mintCommand: string;
  /** Rotation playbook for this provider. */
  rotation: string;
  /** True for the synthetic rule produced by the entropy detector. */
  entropy?: boolean;
}

export type FindingSource = 'worktree' | 'staged' | 'history' | 'env';

export interface CommitInfo {
  hash: string;
  author: string;
  date: string;
}

export interface Finding {
  /** Human facing id: `<rule-id>-<8 hex>`; also what rotate-help accepts. */
  id: string;
  /** Salted baseline hash (no secret material). */
  hash: string;
  ruleId: string;
  ruleName: string;
  severity: Severity;
  /** Repo-relative path with forward slashes. */
  file: string;
  line: number;
  /** Redacted preview: first 4 and last 2 characters at most. */
  preview: string;
  why: string;
  mintCommand: string;
  rotation: string;
  source: FindingSource;
  commit?: CommitInfo;
  /** True when the finding matched the baseline and is therefore not gated on. */
  baselined?: boolean;
}

export interface ScanStats {
  mode: FindingSource;
  filesScanned: number;
  filesSkipped: number;
  bytesScanned: number;
  longLinesSkipped: number;
  truncated: boolean;
  /** Files skipped because they exceeded --max-file-size. */
  oversized: number;
  binaries: number;
  durationMs: number;
}

export interface GuardReport {
  mode: FindingSource;
  stats: ScanStats;
  findings: Finding[];
  /** Findings that matched the baseline (counted, not listed). */
  baselined: number;
  failOn: Severity;
  root: string;
  /** Extra context for the report (history commit counts, git availability, ...). */
  notes?: string[];
}

export interface GuardResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface CustomRuleInput {
  id: string;
  name?: string;
  regex: string;
  severity?: Severity;
  keywords?: string[];
  why?: string;
  mintCommand?: string;
  rotation?: string;
}

export interface RuleOverride {
  severity?: Severity;
  disabled?: boolean;
}

export interface GuardConfig {
  version: number;
  failOn: Severity;
  entropyThreshold: number;
  entropyMinLength: number;
  entropyMaxLength: number;
  entropySeverity: Severity;
  maxFileSize: number;
  includeLockfiles: boolean;
  disabledRules: string[];
  rules: Record<string, RuleOverride>;
  customRules: CustomRuleInput[];
  exclude: string[];
  baselineFile: string;
  ignoreFiles: string[];
  inlineComments: boolean;
  path?: string;
}

export interface GuardContext {
  /** Directory being scanned, as given (or cwd). */
  root: string;
  /** Absolute working directory of the process. */
  cwd: string;
  flags: Flags;
  positionals: string[];
  palette: Palette;
  /** Writes a progress line to stderr; no-op when not a TTY or --quiet. */
  progress(message: string): void;
}

export interface GuardCommand {
  name: string;
  summary: string;
  usage: string;
  details?: readonly string[];
  examples: readonly string[];
  /** Canonical flag names accepted by this subcommand (beyond the global set). */
  flags: readonly string[];
  run(context: GuardContext): GuardResult | Promise<GuardResult>;
}
