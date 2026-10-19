import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { UsageError } from '../errors.js';
import { newSalt } from './redact.js';
import type { Finding, Severity } from './types.js';

/**
 * Baseline files. Only salted hashes are stored - never a secret, never a preview.
 */

export const BASELINE_VERSION = 1;

export interface BaselineEntry {
  id: string;
  hash: string;
  rule: string;
  file: string;
  severity: Severity;
}

export interface BaselineFile {
  version: number;
  salt: string;
  createdAt: string;
  findings: BaselineEntry[];
}

export interface LoadedBaseline {
  salt: string;
  ids: Set<string>;
  entries: BaselineEntry[];
}

function parseBaseline(raw: string, path: string): BaselineFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new UsageError(`${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof parsed !== 'object' || parsed === null) throw new UsageError(`${path} must contain a JSON object`);
  const record = parsed as Record<string, unknown>;
  if (typeof record.salt !== 'string' || record.salt === '') {
    throw new UsageError(`${path} is missing its "salt"; re-create it with "mint guard baseline"`);
  }
  const findings = Array.isArray(record.findings) ? record.findings : [];
  const entries: BaselineEntry[] = [];
  for (const entry of findings) {
    if (typeof entry !== 'object' || entry === null) continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.hash !== 'string') continue;
    entries.push({
      id: typeof item.id === 'string' ? item.id : item.hash,
      hash: item.hash,
      rule: typeof item.rule === 'string' ? item.rule : 'unknown',
      file: typeof item.file === 'string' ? item.file : '',
      severity: (typeof item.severity === 'string' ? item.severity : 'medium') as Severity,
    });
  }
  return {
    version: typeof record.version === 'number' ? record.version : BASELINE_VERSION,
    salt: record.salt,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
    findings: entries,
  };
}

export function readBaseline(path: string): BaselineFile | undefined {
  if (!existsSync(path)) return undefined;
  return parseBaseline(readFileSync(path, 'utf8'), path);
}

/** What a scan needs from the baseline: the salt plus the set of known finding hashes. */
export function loadBaseline(path: string): LoadedBaseline | undefined {
  const file = readBaseline(path);
  if (!file) return undefined;
  return { salt: file.salt, ids: new Set(file.findings.map((entry) => entry.hash)), entries: file.findings };
}

export function baselineEntries(findings: readonly Finding[]): BaselineEntry[] {
  return findings.map((finding) => ({
    id: finding.id,
    hash: finding.hash,
    rule: finding.ruleId,
    file: finding.file,
    severity: finding.severity,
  }));
}

export interface WriteBaselineResult {
  path: string;
  salt: string;
  total: number;
  added: number;
}

/**
 * Write (or refresh) the baseline. Existing entries are kept so refreshing never
 * silently drops findings that are still present but currently out of scope.
 */
export function writeBaseline(
  path: string,
  salt: string,
  findings: readonly Finding[],
  existing: BaselineFile | undefined,
): WriteBaselineResult {
  const merged = new Map<string, BaselineEntry>();
  for (const entry of existing?.findings ?? []) merged.set(entry.hash, entry);
  const before = merged.size;
  for (const entry of baselineEntries(findings)) merged.set(entry.hash, entry);

  const file: BaselineFile = {
    version: BASELINE_VERSION,
    salt: salt === '' ? newSalt() : salt,
    createdAt: new Date().toISOString(),
    findings: [...merged.values()].sort((left, right) => (left.hash < right.hash ? -1 : 1)),
  };

  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
  return { path, salt: file.salt, total: file.findings.length, added: merged.size - before };
}

/** Salt to use for a baseline: keep the existing one so old ids stay stable. */
export function baselineSalt(existing: BaselineFile | undefined): string {
  return existing?.salt ?? newSalt();
}
