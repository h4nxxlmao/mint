import { classifyPlaceholder, extractCandidates, hasSequentialRun, isEntropySecret, isUuidValue, type EntropyOptions } from './entropy.js';
import { lineMatchesKeywords, requiredMarkers } from './rules.js';
import { findingHash, findingId, previewSecret } from './redact.js';
import type { CommitInfo, Finding, FindingSource, Rule } from './types.js';

/** Lines longer than this are skipped for detection (minified bundles, giant JSON blobs). */
export const MAX_LINE_LENGTH = 8000;
const MAX_MATCHES_PER_LINE = 5;
const MAX_CANDIDATES_PER_LINE = 12;

export interface ScanOptions {
  rules: readonly Rule[];
  /** Undefined disables entropy detection. */
  entropyRule: Rule | undefined;
  entropy: EntropyOptions;
  /** Salt for baseline hashes; empty string when no baseline exists. */
  salt: string;
  baselineIds: ReadonlySet<string>;
  inlineComments: boolean;
  maxFindings: number;
}

export interface FileMeta {
  file: string;
  source: FindingSource;
  commit?: CommitInfo;
}

export interface SuppressionContext {
  /** Line above, used for `mintguard:ignore-next-line`. */
  previousLine?: string;
}

export interface ScanOutcome {
  findings: Finding[];
  baselined: number;
  truncated: boolean;
  longLinesSkipped: number;
}

const INLINE_IGNORE = /mintguard:\s*ignore\b([^]*?)$/iu;
const INLINE_IGNORE_NEXT = /mintguard:\s*ignore-next-line\b([^]*?)$/iu;

interface Suppression {
  all: boolean;
  rules: Set<string>;
}

function parseSuppression(line: string | undefined, pattern: RegExp): Suppression | undefined {
  if (line === undefined) return undefined;
  const match = pattern.exec(line);
  if (match === null) return undefined;
  const tail = (match[1] ?? '').trim();
  if (tail === '') return { all: true, rules: new Set() };
  const rules = new Set(
    tail
      .split(/[\s,]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length > 0),
  );
  return rules.size === 0 ? { all: true, rules } : { all: false, rules };
}

function suppressionFor(line: string, context: SuppressionContext, enabled: boolean): Suppression | undefined {
  if (!enabled) return undefined;
  const inline = parseSuppression(line, INLINE_IGNORE);
  if (inline) return inline;
  return parseSuppression(context.previousLine, INLINE_IGNORE_NEXT);
}

function isSuppressed(suppression: Suppression | undefined, ruleId: string): boolean {
  if (!suppression) return false;
  if (suppression.all) return true;
  return suppression.rules.has(ruleId);
}

/** `privatePem`, `publicKey` - references to variables, not literal credentials. */
const IDENTIFIER_LIKE = /^[a-z][A-Za-z0-9_]*$/u;

/**
 * `config.apiKey`, `process.env` - member access, not a literal. Only short dotted
 * identifiers qualify; a JWT's segments are far too long to be mistaken for code.
 */
function isMemberAccess(value: string): boolean {
  if (!value.includes('.')) return false;
  const parts = value.split('.');
  if (parts.length < 2 || parts.length > 4) return false;
  return parts.every((part) => part.length > 0 && part.length <= 20 && /^[A-Za-z_][A-Za-z0-9_]*$/u.test(part));
}

function acceptableValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 4) return false;
  if (/^(?:true|false|null|none|nil|undefined|\d+)$/iu.test(trimmed)) return false;
  if (hasSequentialRun(trimmed)) return false;
  if (isUuidValue(trimmed)) return false;
  // Short identifiers and dotted references are code, not credentials.
  if (IDENTIFIER_LIKE.test(trimmed) && trimmed.length < 12) return false;
  if (isMemberAccess(trimmed)) return false;
  return classifyPlaceholder(trimmed) === undefined;
}

/**
 * Stateful, single pass scanner. Raw secret values stay inside this class: findings
 * only ever carry a redacted preview and hashes.
 */
export class Scanner {
  private readonly collected: Finding[] = [];
  /** `${file}|${line}|${value}` -> index in `collected`, for span dedupe. */
  private readonly spans = new Map<string, number>();
  private readonly compiled = new Map<string, RegExp>();
  private truncated = false;
  private longLines = 0;

  constructor(private readonly options: ScanOptions) {}

  scanLine(line: string, lineNumber: number, meta: FileMeta, context: SuppressionContext = {}, rules: readonly Rule[] = this.options.rules): void {
    if (line.length > MAX_LINE_LENGTH) {
      this.longLines++;
      return;
    }
    if (line.trim() === '') return;

    const suppression = suppressionFor(line, context, this.options.inlineComments);
    if (suppression?.all) return;

    const usedValues = new Set<string>();
    for (const rule of rules) {
      if (isSuppressed(suppression, rule.id)) continue;
      this.runRule(rule, line, lineNumber, meta, usedValues);
    }

    if (this.options.entropyRule !== undefined) {
      this.runEntropy(this.options.entropyRule, line, lineNumber, meta, usedValues);
    }
  }

  /** Scan a whole file body, handling whole-file rules and inline suppression. */
  scanContent(content: string, meta: FileMeta, markers: ReadonlySet<string> | null): void {
    const rules = eligibleRules(this.options.rules, markers);
    const lines = content.split(/\r?\n/u);
    let previousLine: string | undefined;
    for (let index = 0; index < lines.length; index++) {
      this.scanLine(lines[index], index + 1, meta, { previousLine }, rules);
      previousLine = lines[index];
    }
  }

  private runRule(rule: Rule, line: string, lineNumber: number, meta: FileMeta, usedValues: Set<string>): void {
    if (rule.regex === '') return;
    if (!lineMatchesKeywords(line, rule)) return;

    const regex = this.compiledRule(rule);
    regex.lastIndex = 0;
    let matches = 0;
    for (;;) {
      const match = regex.exec(line);
      if (match === null) break;
      if (match.index === regex.lastIndex) regex.lastIndex++;
      const value = (match[rule.capture ?? 0] ?? '').trim();
      matches++;
      if (matches > MAX_MATCHES_PER_LINE) break;
      if (value === '' || !acceptableValue(value)) continue;
      usedValues.add(value);
      this.record(rule, value, lineNumber, meta);
    }
  }

  private runEntropy(rule: Rule, line: string, lineNumber: number, meta: FileMeta, usedValues: Set<string>): void {
    let considered = 0;
    for (const candidate of extractCandidates(line)) {
      if (considered >= MAX_CANDIDATES_PER_LINE) break;
      considered++;
      const value = candidate.value;
      if (usedValues.has(value)) continue;
      if (!acceptableValue(value)) continue;
      if (!isEntropySecret(value, this.options.entropy, line)) continue;
      usedValues.add(value);
      this.record(rule, value, lineNumber, meta);
    }
  }

  private compiledRule(rule: Rule): RegExp {
    const existing = this.compiled.get(rule.id);
    if (existing) return existing;
    let regex: RegExp;
    try {
      const flags = rule.flags ?? 'gu';
      regex = new RegExp(rule.regex, flags.includes('g') ? flags : `${flags}g`);
    } catch (error) {
      throw new Error(`rule "${rule.id}" has an invalid regex: ${String(error)}`);
    }
    this.compiled.set(rule.id, regex);
    return regex;
  }

  private record(rule: Rule, value: string, lineNumber: number, meta: FileMeta): void {
    const spanKey = `${meta.file}|${String(lineNumber)}|${value}`;
    const existingIndex = this.spans.get(spanKey);
    const severity = rule.severity;

    if (existingIndex !== undefined) {
      // Same value, two rules: keep the more severe one (a JWT that is also a
      // Supabase service key should be reported once, at the higher severity).
      const existing = this.collected[existingIndex];
      if (existing.severity !== severity && rank(severity) > rank(existing.severity)) {
        this.collected[existingIndex] = this.build(rule, value, lineNumber, meta);
      }
      return;
    }

    if (this.collected.length >= this.options.maxFindings) {
      this.truncated = true;
      return;
    }
    this.spans.set(spanKey, this.collected.length);
    this.collected.push(this.build(rule, value, lineNumber, meta));
  }

  private build(rule: Rule, value: string, lineNumber: number, meta: FileMeta): Finding {
    const hash = findingHash(this.options.salt, rule.id, meta.file, value);
    const baselined = this.options.baselineIds.has(hash);
    const finding: Finding = {
      id: findingId(rule.id, meta.file, lineNumber, value),
      hash,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      file: meta.file,
      line: lineNumber,
      preview: previewSecret(value),
      why: rule.why,
      mintCommand: rule.mintCommand,
      rotation: rule.rotation,
      source: meta.source,
    };
    if (meta.commit) finding.commit = meta.commit;
    if (baselined) finding.baselined = true;
    return finding;
  }

  outcome(): ScanOutcome {
    let baselined = 0;
    const findings: Finding[] = [];
    for (const finding of this.collected) {
      if (finding.baselined) baselined++;
      else findings.push(finding);
    }
    return { findings, baselined, truncated: this.truncated, longLinesSkipped: this.longLines };
  }
}

function rank(severity: string): number {
  switch (severity) {
    case 'critical':
      return 3;
    case 'high':
      return 2;
    case 'medium':
      return 1;
    default:
      return 0;
  }
}

/** Rule ids whose whole-file markers are all present in `content`. */
export function fileMarkers(content: string, rules: readonly Rule[]): Set<string> {
  const markers = new Set<string>();
  for (const rule of rules) {
    const required = requiredMarkers(rule);
    if (required.length === 0) continue;
    if (required.every((marker) => content.includes(marker))) markers.add(rule.id);
  }
  return markers;
}

/**
 * Rules that are eligible for a file, given the markers found in it.
 *
 * `markers === null` means "line context only" (git history, where the surrounding
 * file text is not available): whole-file rules are skipped there rather than firing
 * on a single line and producing false positives.
 */
export function eligibleRules(rules: readonly Rule[], markers: ReadonlySet<string> | null): Rule[] {
  if (markers === null) return rules.filter((rule) => requiredMarkers(rule).length === 0);
  return rules.filter((rule) => requiredMarkers(rule).length === 0 || markers.has(rule.id));
}
