import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SKIP_DIRS } from './walker.js';
import { gitAvailable, isIgnoredByGit, repoRoot, trackedPaths } from './git.js';
import { ENV_RULES } from './rotate.js';
import { Scanner, fileMarkers, type ScanOptions } from './scan.js';
import { findingHash, findingId } from './redact.js';
import type { Finding, Rule } from './types.js';

/** `.env`, `.env.local`, `.env.production` - but not `.env.example`. */
const ENV_FILE = /^\.env(?:\.[A-Za-z0-9_-]+)?$/u;
/** direnv files often export the same secrets as .env and are just as easy to commit. */
const EXTRA_ENV_FILES: readonly string[] = ['.envrc'];
export const EXAMPLE_FILES: readonly string[] = ['.env.example', '.env.sample', '.env.template', '.env.dist', '.env.defaults'];
const MAX_DEPTH = 8;

interface EnvFile {
  /** Path relative to the scan root, forward slashes. */
  path: string;
  absolute: string;
}

function collectEnvFiles(root: string): EnvFile[] {
  const found: EnvFile[] = [];
  const stack: Array<{ relative: string; depth: number }> = [{ relative: '', depth: 0 }];
  while (stack.length > 0) {
    const { relative, depth } = stack.pop()!;
    if (depth > MAX_DEPTH) continue;
    const absoluteDir = relative === '' ? root : join(root, relative);
    let entries;
    try {
      entries = readdirSync(absoluteDir, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((left, right) => (left.name < right.name ? -1 : 1));
    for (const entry of entries) {
      const childRelative = relative === '' ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (DEFAULT_SKIP_DIRS.has(entry.name)) continue;
        stack.push({ relative: childRelative, depth: depth + 1 });
        continue;
      }
      if (!entry.isFile()) continue;
      if (ENV_FILE.test(entry.name) || EXTRA_ENV_FILES.includes(entry.name) || EXAMPLE_FILES.includes(entry.name)) {
        found.push({ path: childRelative, absolute: join(absoluteDir, entry.name) });
      }
    }
  }
  return found.sort((left, right) => (left.path < right.path ? -1 : 1));
}

export interface EnvCheckOptions {
  root: string;
  scan: ScanOptions;
  /** True when the caller wants the contents of tracked/at-risk env files scanned too. */
  scanContents: boolean;
}

export interface EnvCheckOutcome {
  findings: Finding[];
  notes: string[];
  filesChecked: number;
}

function syntheticFinding(rule: Rule, file: string, reason: string, scan: ScanOptions): Finding {
  const hash = findingHash(scan.salt, rule.id, file, reason);
  const finding: Finding = {
    id: findingId(rule.id, file, 0, reason),
    hash,
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    file,
    line: 0,
    // File-level hygiene findings have no secret to redact.
    preview: '***',
    why: rule.why,
    mintCommand: rule.mintCommand,
    rotation: rule.rotation,
    source: 'env',
  };
  if (scan.baselineIds.has(hash)) finding.baselined = true;
  return finding;
}

/**
 * Environment hygiene: env files that are tracked or would be committed, a missing
 * example file, and example files that contain real-looking values.
 */
export function runEnvChecks(options: EnvCheckOptions): EnvCheckOutcome {
  const notes: string[] = [];
  const findings: Finding[] = [];
  const files = collectEnvFiles(options.root);
  const envFiles = files.filter((file) => isEnvFile(file.path));
  const exampleFiles = files.filter((file) => EXAMPLE_FILES.includes(file.path.split('/').pop() ?? ''));

  const root = repoRoot(options.root);
  const tracked = root ? trackedPaths(root) : undefined;
  if (!root) {
    notes.push(
      gitAvailable()
        ? 'not a git repository: tracked and gitignore checks were skipped'
        : 'git is not available: tracked and gitignore checks were skipped',
    );
  }

  let filesChecked = 0;
  for (const file of envFiles) {
    filesChecked++;
    const isTracked = tracked?.has(file.path) === true;
    const ignored = root ? isIgnoredByGit(root, file.path) : true;

    if (isTracked) {
      findings.push(syntheticFinding(ENV_RULES[0], file.path, `tracked:${file.path}`, options.scan));
    } else if (root && !ignored) {
      findings.push(syntheticFinding(ENV_RULES[1], file.path, `not-ignored:${file.path}`, options.scan));
    }

    if (options.scanContents && (isTracked || (root && !ignored))) {
      try {
        const content = readFileSync(file.absolute, 'utf8');
        const scanner = new Scanner(options.scan);
        scanner.scanContent(content, { file: file.path, source: 'env' }, fileMarkers(content, options.scan.rules));
        const outcome = scanner.outcome();
        findings.push(...outcome.findings);
      } catch {
        notes.push(`${file.path}: could not be read`);
      }
    }
  }

  if (envFiles.length > 0 && exampleFiles.length === 0) {
    findings.push(syntheticFinding(ENV_RULES[2], EXAMPLE_FILES[0], 'missing:example', options.scan));
  }

  for (const file of exampleFiles) {
    filesChecked++;
    let content: string;
    try {
      content = readFileSync(file.absolute, 'utf8');
    } catch {
      continue;
    }
    const scanner = new Scanner(options.scan);
    scanner.scanContent(content, { file: file.path, source: 'env' }, fileMarkers(content, options.scan.rules));
    for (const finding of scanner.outcome().findings) {
      findings.push({ ...finding, severity: finding.severity === 'low' ? 'high' : finding.severity });
    }
  }

  return { findings, notes, filesChecked };
}

/** Used by tests and by `env` to check a single file's shape without walking. */
export function envFileKind(name: string): 'env' | 'example' | 'other' {
  if (EXAMPLE_FILES.includes(name)) return 'example';
  return ENV_FILE.test(name) || EXTRA_ENV_FILES.includes(name) ? 'env' : 'other';
}

export function isEnvFile(path: string): boolean {
  const base = path.split(/[\\/]/u).pop() ?? '';
  if (EXAMPLE_FILES.includes(base)) return false;
  return ENV_FILE.test(base) || EXTRA_ENV_FILES.includes(base);
}

/** Size guard shared with the walker. */
export function fileSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}
