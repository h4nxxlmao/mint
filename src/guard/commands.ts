import { readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { UsageError } from '../errors.js';
import { VERSION } from '../version.js';
import { baselineSalt, loadBaseline, readBaseline, writeBaseline } from './baseline.js';
import { readCheckInput, renderCheckJson, renderCheckText, scanValue } from './check.js';
import { resolveOptions, type ResolvedOptions } from './config.js';
import { runEnvChecks } from './env.js';
import { installHook, uninstallHook } from './hook.js';
import { initGuard } from './init.js';
import {
  assertRevision,
  requireRepo,
  repoRoot,
  resolveSince,
  stagedContent,
  stagedPaths,
  streamDiff,
  streamHistory,
} from './git.js';
import type { IgnoreSet } from './gitignore.js';
import { allRulesWithEnv, renderRotateHelp, renderRuleTable } from './rotate.js';
import { defaultRotation } from './rules.js';
import { Scanner, eligibleRules, fileMarkers, type ScanOptions } from './scan.js';
import { buildIgnoreSet } from './suppression.js';
import { looksBinary, walkFiles } from './walker.js';
import { renderReport, resolveFormat, type ReportFormat } from './reports/index.js';
import { statsSummary } from './reports/shared.js';
import { isSeverity, severityRank } from './types.js';
import type { Finding, GuardCommand, GuardContext, GuardReport, GuardResult, Rule, ScanStats } from './types.js';

const MAX_FINDINGS = 5000;
const PROGRESS_EVERY = 250;
const MAX_VERBOSE = 500;

interface ScanResult {
  findings: Finding[];
  baselined: number;
  stats: ScanStats;
  notes: string[];
  /** Baseline hashes that this scan still matched (used by `baseline --prune`). */
  baselineMatched?: string[];
  /** Skip lines for `--verbose`. */
  verbose?: string[];
}

/** `--verbose` diagnostics go to stderr so stdout stays pipeable. */
function withVerbose(result: GuardResult, scan: ScanResult): GuardResult {
  const lines = scan.verbose ?? [];
  if (lines.length === 0) return result;
  const capped = lines.length > MAX_VERBOSE ? [...lines.slice(0, MAX_VERBOSE), `... ${String(lines.length - MAX_VERBOSE)} more`] : lines;
  return { ...result, stderr: `${result.stderr}${capped.join('\n')}\n` };
}

function newStats(mode: ScanStats['mode']): ScanStats {
  return {
    mode,
    filesScanned: 0,
    filesSkipped: 0,
    bytesScanned: 0,
    longLinesSkipped: 0,
    truncated: false,
    oversized: 0,
    binaries: 0,
    durationMs: 0,
  };
}

function scanRoot(context: GuardContext): string {
  const target = context.positionals[0] ?? '.';
  const absolute = resolve(context.cwd, target);
  let stat;
  try {
    stat = statSync(absolute);
  } catch {
    throw new UsageError(`path not found: ${target}`);
  }
  if (!stat.isDirectory()) throw new UsageError(`not a directory: ${target}`);
  return absolute;
}

/**
 * What a scan should look at: a directory, or a single file. Git based scans use
 * the repository-relative `prefix` / `filePath` to filter their file lists.
 */
interface ScanTarget {
  /** Directory used for config discovery and ignore files. */
  root: string;
  /** Absolute path when a single file was given. */
  file?: string;
  /** Repository-relative prefix of `root` (empty at the repository root). */
  prefix: string;
  /** Repository-relative path of the single file. */
  filePath?: string;
}

function scanTarget(context: GuardContext): ScanTarget {
  const target = context.positionals[0] ?? '.';
  const absolute = resolve(context.cwd, target);
  let stat;
  try {
    stat = statSync(absolute);
  } catch {
    throw new UsageError(`path not found: ${target}`);
  }
  if (stat.isDirectory()) {
    return { root: absolute, prefix: displayPrefix(absolute) };
  }
  if (stat.isFile()) {
    const root = dirname(absolute);
    const prefix = displayPrefix(root);
    return { root, file: absolute, prefix, filePath: `${prefix}${basename(absolute)}` };
  }
  throw new UsageError(`not a file or directory: ${target}`);
}

function matchesTarget(path: string, target: ScanTarget): boolean {
  if (target.filePath !== undefined) return path === target.filePath;
  return target.prefix === '' || path.startsWith(target.prefix);
}

/**
 * Tool files that never contain findings worth reporting. The baseline in particular
 * holds a random salt and hashes, which the entropy detector would otherwise flag.
 */
function toolFileNames(options: ResolvedOptions): Set<string> {
  return new Set([basename(options.baselineFile), '.mintguard-baseline.json']);
}

function isToolFile(path: string, options: ResolvedOptions): boolean {
  return toolFileNames(options).has(basename(path));
}

function isIgnoredPath(path: string, target: ScanTarget, ignore: IgnoreSet, options: ResolvedOptions): boolean {
  // An explicitly named file is always scanned, even if an ignore rule matches it.
  if (target.filePath !== undefined) return false;
  if (isToolFile(path, options)) return true;
  const local = target.prefix !== '' && path.startsWith(target.prefix) ? path.slice(target.prefix.length) : path;
  return ignore.ignoresPath(local);
}

function settings(options: ResolvedOptions, overrides: Partial<ScanOptions> = {}): ScanOptions {
  return {
    rules: options.rules,
    entropyRule: options.entropyRule,
    entropy: options.entropy,
    salt: options.salt,
    baselineIds: options.baselineIds,
    inlineComments: options.config.inlineComments,
    maxFindings: MAX_FINDINGS,
    ...overrides,
  };
}

function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(
    (left, right) =>
      severityRank(right.severity) - severityRank(left.severity) ||
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.ruleId.localeCompare(right.ruleId),
  );
}

/**
 * Path prefix that turns a scan-root-relative path into a repository-relative one,
 * so findings stay stable when a subdirectory is scanned. Both paths are
 * canonicalised first: git may report long paths where the shell used 8.3 names.
 */
function canonicalPath(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    return path;
  }
}

function displayPrefix(root: string): string {
  const repo = repoRoot(root);
  if (repo === undefined) return '';
  const inside = relative(canonicalPath(repo), canonicalPath(root)).split(sep).join('/');
  if (inside === '' || inside.startsWith('..')) return '';
  return `${inside}/`;
}

function scanWorktree(
  context: GuardContext,
  options: ResolvedOptions,
  target: ScanTarget,
  overrides: Partial<ScanOptions> = {},
): ScanResult {
  const ignore = buildIgnoreSet(target.root, options.config, options.useGitignore);
  const scanner = new Scanner(settings(options, overrides));
  const stats = newStats('worktree');

  if (target.file !== undefined) {
    let buffer: Buffer;
    try {
      buffer = readFileSync(target.file);
    } catch {
      throw new UsageError(`cannot read ${target.filePath ?? target.file}`);
    }
    if (looksBinary(buffer)) {
      stats.binaries++;
      stats.filesSkipped++;
    } else {
      const content = buffer.toString('utf8');
      stats.filesScanned = 1;
      stats.bytesScanned = buffer.length;
      const displayPath = target.filePath ?? basename(target.file);
      scanner.scanContent(content, { file: displayPath, source: 'worktree' }, fileMarkers(content, options.rules));
    }
    const outcome = scanner.outcome();
    stats.longLinesSkipped = outcome.longLinesSkipped;
    stats.truncated = outcome.truncated;
    return {
      findings: outcome.findings,
      baselined: outcome.baselined,
      stats,
      notes: [],
      baselineMatched: outcome.baselinedHashes,
    };
  }

  let seen = 0;
  const unreadable: string[] = [];
  const verbose: string[] = [];
  const verboseEnabled = context.flags.getBool('verbose');
  for (const event of walkFiles({
    root: target.root,
    maxFileSize: options.maxFileSize,
    includeLockfiles: options.includeLockfiles,
    ignore,
    useGitignore: options.useGitignore,
    extraSkipFiles: [...toolFileNames(options)],
  })) {
    if (event.type === 'skip') {
      stats.filesSkipped++;
      if (event.reason === 'too-large') stats.oversized++;
      if (event.reason === 'binary-extension') stats.binaries++;
      if (verboseEnabled) verbose.push(`skip  ${event.path}  (${event.reason})`);
      continue;
    }

    let buffer: Buffer;
    try {
      buffer = readFileSync(event.absolute);
    } catch {
      stats.filesSkipped++;
      unreadable.push(event.path);
      if (verboseEnabled) verbose.push(`skip  ${event.path}  (unreadable)`);
      continue;
    }
    if (looksBinary(buffer)) {
      stats.binaries++;
      stats.filesSkipped++;
      if (verboseEnabled) verbose.push(`skip  ${event.path}  (binary)`);
      continue;
    }

    const content = buffer.toString('utf8');
    const displayPath = target.prefix === '' ? event.path : `${target.prefix}${event.path}`;
    stats.filesScanned++;
    stats.bytesScanned += event.size;
    scanner.scanContent(content, { file: displayPath, source: 'worktree' }, fileMarkers(content, options.rules));
    seen++;
    if (seen % PROGRESS_EVERY === 0) context.progress(`scanned ${String(seen)} files...`);
  }

  const outcome = scanner.outcome();
  stats.longLinesSkipped = outcome.longLinesSkipped;
  stats.truncated = outcome.truncated;
  const notes: string[] = [];
  if (unreadable.length > 0) {
    const listed = unreadable.slice(0, 3).join(', ');
    const rest = unreadable.length > 3 ? ` and ${String(unreadable.length - 3)} more` : '';
    notes.push(`${String(unreadable.length)} file(s) could not be read: ${listed}${rest}`);
  }
  return {
    findings: outcome.findings,
    baselined: outcome.baselined,
    stats,
    notes,
    baselineMatched: outcome.baselinedHashes,
    verbose,
  };
}

function scanStaged(context: GuardContext, options: ResolvedOptions, target: ScanTarget): ScanResult {
  const repo = requireRepo(target.root, '"mint guard scan --staged"');
  const ignore = buildIgnoreSet(target.root, options.config, options.useGitignore);
  const allPaths = stagedPaths(repo);
  const verboseEnabled = context.flags.getBool('verbose');
  const verbose: string[] = [];
  const paths: string[] = [];
  for (const path of allPaths) {
    if (!matchesTarget(path, target)) {
      if (verboseEnabled) verbose.push(`skip  ${path}  (outside target)`);
      continue;
    }
    if (isIgnoredPath(path, target, ignore, options)) {
      if (verboseEnabled) verbose.push(`skip  ${path}  (ignored)`);
      continue;
    }
    paths.push(path);
  }
  const scanner = new Scanner(settings(options));
  const stats = newStats('staged');

  context.progress(`scanning ${String(paths.length)} staged file(s)...`);
  for (const path of paths) {
    const content = stagedContent(repo, path);
    if (content === undefined) {
      stats.filesSkipped++;
      continue;
    }
    const buffer = Buffer.from(content, 'utf8');
    if (looksBinary(buffer)) {
      stats.binaries++;
      stats.filesSkipped++;
      continue;
    }
    stats.filesScanned++;
    stats.bytesScanned += buffer.length;
    scanner.scanContent(content, { file: path, source: 'staged' }, fileMarkers(content, options.rules));
  }

  const outcome = scanner.outcome();
  stats.longLinesSkipped = outcome.longLinesSkipped;
  stats.truncated = outcome.truncated;
  let notes: string[] = [];
  if (allPaths.length === 0) notes = ['nothing staged: git diff --cached is empty'];
  else if (paths.length === 0) notes = ['no staged changes for this path'];
  return {
    findings: outcome.findings,
    baselined: outcome.baselined,
    stats,
    notes,
    baselineMatched: outcome.baselinedHashes,
    verbose,
  };
}

async function scanHistory(context: GuardContext, options: ResolvedOptions, target: ScanTarget): Promise<ScanResult> {
  const repo = requireRepo(target.root, '"mint guard scan --history"');
  const ignore = buildIgnoreSet(target.root, options.config, options.useGitignore);
  const since = context.flags.getString('since');
  const sinceArgs = since === undefined ? undefined : resolveSince(repo, since);
  const scanner = new Scanner(settings(options));
  const rules = eligibleRules(options.rules, null);
  const stats = newStats('history');
  const seen = new Set<string>();
  let commits = 0;

  const summary = await streamHistory(
    repo,
    { ...(sinceArgs === undefined ? {} : { sinceArgs }) },
    {
      onCommit() {
        commits++;
        if (commits % 100 === 0) context.progress(`scanned ${String(commits)} commits...`);
      },
      scanLine(line, lineNumber, file, commit) {
        if (!matchesTarget(file, target) || isIgnoredPath(file, target, ignore, options)) return;
        seen.add(file);
        stats.bytesScanned += Buffer.byteLength(line, 'utf8') + 1;
        scanner.scanLine(line, lineNumber, { file, source: 'history', commit }, {}, rules);
      },
    },
  );

  stats.filesScanned = seen.size;
  const outcome = scanner.outcome();
  stats.longLinesSkipped = outcome.longLinesSkipped;
  stats.truncated = outcome.truncated;
  const notes = [
    `${String(summary.commits)} commit${summary.commits === 1 ? '' : 's'} scanned`,
    'history findings show the commit that introduced each secret',
  ];
  return {
    findings: outcome.findings,
    baselined: outcome.baselined,
    stats,
    notes,
    baselineMatched: outcome.baselinedHashes,
  };
}

async function scanDiff(
  options: ResolvedOptions,
  target: ScanTarget,
  revision: string,
): Promise<ScanResult> {
  const repo = requireRepo(target.root, '"mint guard scan --diff"');
  const ignore = buildIgnoreSet(target.root, options.config, options.useGitignore);
  const scanner = new Scanner(settings(options));
  const rules = eligibleRules(options.rules, null);
  const stats = newStats('diff');
  const seen = new Set<string>();

  const summary = await streamDiff(repo, revision, {
    scanLine(line, lineNumber, file) {
      if (!matchesTarget(file, target) || isIgnoredPath(file, target, ignore, options)) return;
      seen.add(file);
      stats.bytesScanned += Buffer.byteLength(line, 'utf8') + 1;
      scanner.scanLine(line, lineNumber, { file, source: 'diff' }, {}, rules);
    },
  });

  stats.filesScanned = seen.size;
  const outcome = scanner.outcome();
  stats.longLinesSkipped = outcome.longLinesSkipped;
  stats.truncated = outcome.truncated;
  const notes = [`diff ${revision}...HEAD: ${String(summary.files)} changed file${summary.files === 1 ? '' : 's'}`];
  return {
    findings: outcome.findings,
    baselined: outcome.baselined,
    stats,
    notes,
    baselineMatched: outcome.baselinedHashes,
  };
}

function exitCodeFor(report: GuardReport): number {
  const threshold = severityRank(report.failOn);
  return report.findings.some((finding) => severityRank(finding.severity) >= threshold) ? 1 : 0;
}

function formatContext(context: GuardContext) {
  return {
    palette: context.palette,
    version: VERSION,
    fix: context.flags.getBool('fix'),
    quiet: context.flags.getBool('quiet'),
  };
}

function fixAppendix(findings: readonly Finding[], palette: GuardContext['palette']): string {
  const seen = new Map<string, Finding>();
  for (const finding of findings) if (!seen.has(finding.ruleId)) seen.set(finding.ruleId, finding);
  if (seen.size === 0) return '';

  const lines: string[] = ['', palette.bold('fix plan'), ''];
  let index = 1;
  for (const finding of seen.values()) {
    const advice = defaultRotation(finding.rotation);
    lines.push(`${String(index)}. ${advice.provider} - ${finding.ruleName}`);
    for (const step of advice.steps) lines.push(`   - ${step}`);
    lines.push(`   ${palette.green(finding.mintCommand)}`);
    if (advice.links) for (const link of advice.links) lines.push(`   ${palette.dim(link)}`);
    lines.push('');
    index++;
  }
  return `${lines.join('\n')}\n`;
}

function finishReport(
  report: GuardReport,
  context: GuardContext,
  format: ReportFormat,
  rules: readonly Rule[],
): GuardResult {
  const stdout = renderReport(report, format, formatContext(context), rules);
  const appendix = context.flags.getBool('fix') && format === 'text' ? fixAppendix(report.findings, context.palette) : '';
  return {
    code: exitCodeFor(report),
    stdout: appendix === '' ? stdout : `${stdout}${appendix}`,
    stderr: '',
  };
}

function buildReport(
  mode: ScanStats['mode'],
  result: ScanResult,
  options: ResolvedOptions,
  root: string,
  notes: string[] = [],
): GuardReport {
  return {
    mode,
    stats: result.stats,
    findings: sortFindings(result.findings),
    baselined: result.baselined,
    failOn: options.failOn,
    root,
    notes: [...result.notes, ...notes],
  };
}

function startTimer(): number {
  return Date.now();
}

function stopTimer(stats: ScanStats, started: number): void {
  stats.durationMs = Date.now() - started;
}

/** `--exit-zero` turns any scan into an audit that never fails the build. */
function applyExitMode(result: GuardResult, context: GuardContext): GuardResult {
  return context.flags.getBool('exit-zero') ? { ...result, code: 0 } : result;
}

// ------------------------------------------------------------------ scan
function scanCommand(context: GuardContext): GuardResult | Promise<GuardResult> {
  const flags = context.flags;
  const modes = [flags.getBool('staged'), flags.getBool('history'), flags.has('diff')].filter((enabled) => enabled).length;
  if (modes > 1) {
    throw new UsageError('use only one of --staged, --history or --diff');
  }
  if (flags.getBool('staged') && flags.has('since')) {
    throw new UsageError('--since only applies to --history');
  }
  if (flags.has('diff') && flags.has('since')) {
    throw new UsageError('--since only applies to --history');
  }

  const format = resolveFormat(flags);
  const target = scanTarget(context);
  const options = resolveOptions(context, target.root, loadBaseline);
  const started = startTimer();
  const rules = allRulesWithEnv(options.rules);

  if (flags.getBool('history')) {
    return scanHistory(context, options, target).then((result) => {
      stopTimer(result.stats, started);
      const report = finishReport(buildReport('history', result, options, target.root), context, format, rules);
      return applyExitMode(withVerbose(report, result), context);
    });
  }

  if (flags.has('diff')) {
    const revision = assertRevision(flags.getString('diff') ?? '', '--diff');
    return scanDiff(options, target, revision).then((result) => {
      stopTimer(result.stats, started);
      const report = finishReport(buildReport('diff', result, options, target.root), context, format, rules);
      return applyExitMode(withVerbose(report, result), context);
    });
  }

  if (flags.getBool('staged')) {
    const result = scanStaged(context, options, target);
    stopTimer(result.stats, started);
    const report = finishReport(buildReport('staged', result, options, target.root), context, format, rules);
    return applyExitMode(withVerbose(report, result), context);
  }

  const result = scanWorktree(context, options, target);
  stopTimer(result.stats, started);
  const report = finishReport(buildReport('worktree', result, options, target.root), context, format, rules);
  return applyExitMode(withVerbose(report, result), context);
}

// ----------------------------------------------------------------- check
function checkCommand(context: GuardContext): GuardResult {
  const format = resolveFormat(context.flags);
  const options = resolveOptions(context, context.root, () => undefined);
  const input = readCheckInput(context);
  const findings = scanValue(input.value, options).filter((finding) => finding.baselined !== true);

  const threshold = severityRank(options.failOn);
  const code = findings.some((finding) => severityRank(finding.severity) >= threshold) ? 1 : 0;

  if (format === 'json') {
    return { code, stdout: renderCheckJson(input, findings), stderr: '' };
  }
  if (format !== 'text') {
    throw new UsageError(`mint guard check supports --format text or json (got "${format}")`);
  }
  return { code, stdout: renderCheckText(input, findings, options, context), stderr: '' };
}

// ------------------------------------------------------------------- env
function envCommand(context: GuardContext): GuardResult {
  const format = resolveFormat(context.flags);
  const root = scanRoot(context);
  const options = resolveOptions(context, root, loadBaseline);
  const started = startTimer();

  const outcome = runEnvChecks({ root, scan: settings(options), scanContents: true });
  const stats = newStats('env');
  stats.filesScanned = outcome.filesChecked;
  stopTimer(stats, started);

  const findings = outcome.findings.filter((finding) => finding.baselined !== true);
  const result: ScanResult = {
    findings,
    baselined: outcome.findings.length - findings.length,
    stats,
    notes: outcome.notes,
  };
  return applyExitMode(
    finishReport(buildReport('env', result, options, root), context, format, allRulesWithEnv(options.rules)),
    context,
  );
}

// -------------------------------------------------------------- baseline
function baselineCommand(context: GuardContext): GuardResult {
  const target = scanTarget(context);
  if (target.file !== undefined) throw new UsageError('baseline works on a directory, not a single file');
  const options = resolveOptions(context, target.root, () => undefined);
  const existing = readBaseline(options.baselineFile);
  const salt = baselineSalt(existing);
  const existingHashes = new Set((existing?.findings ?? []).map((entry) => entry.hash));
  const started = startTimer();
  const result = scanWorktree(context, options, target, { salt, baselineIds: existingHashes });
  stopTimer(result.stats, started);

  const prune = context.flags.getBool('prune');
  const written = writeBaseline(options.baselineFile, salt, result.findings, existing, {
    prune,
    matchedHashes: result.baselineMatched ?? [],
  });

  const lines: string[] = [];
  lines.push(`${context.palette.bold('mint guard baseline')}`);
  lines.push('');
  lines.push(`  wrote ${String(written.total)} finding hash${written.total === 1 ? '' : 'es'} to ${written.path}`);
  lines.push(
    `  ${String(written.added)} new since the last baseline${prune ? `, ${String(written.removed)} stale entr${written.removed === 1 ? 'y' : 'ies'} pruned` : ''}`,
  );
  lines.push(`  ${context.palette.dim(statsSummary(result.stats))}`);
  lines.push('');
  lines.push('  these findings are now ignored: only new leaks will fail a scan.');
  if (!prune) lines.push(`  ${context.palette.dim('run with --prune to drop entries whose finding is gone.')}`);
  lines.push(`  ${context.palette.dim('the file holds salted hashes, never secrets - commit it if you like.')}`);
  return { code: 0, stdout: `${lines.join('\n')}\n`, stderr: '' };
}

// ------------------------------------------------------------------ init
function initCommand(context: GuardContext): GuardResult {
  const result = initGuard(scanRoot(context), context.flags.getBool('force'));
  const lines: string[] = [`${context.palette.bold('mint guard init')}`, ''];
  const describe = (path: string, outcome: string): string => {
    if (outcome === 'created') return `created   ${path}`;
    if (outcome === 'overwritten') return `replaced  ${path}`;
    return `kept      ${path} ${context.palette.dim('(already exists; use --force to overwrite)')}`;
  };
  lines.push(`  ${describe(result.configPath, result.config)}`);
  lines.push(`  ${describe(result.ignorePath, result.ignore)}`);
  lines.push('');
  lines.push(`  next: ${context.palette.green('mint guard scan')}`);
  return { code: 0, stdout: `${lines.join('\n')}\n`, stderr: '' };
}

// ------------------------------------------------------------------ hooks
function installHookCommand(context: GuardContext): GuardResult {
  const failOn = context.flags.getString('fail-on') ?? 'medium';
  if (!isSeverity(failOn)) {
    throw new UsageError(`--fail-on must be one of critical, high, medium, low (got "${failOn}")`);
  }
  const result = installHook(scanRoot(context), failOn, context.flags.getBool('force'));
  const lines: string[] = [`${context.palette.bold('mint guard install-hook')}`, ''];
  const verb = result.action === 'created' ? 'created' : result.action === 'appended' ? 'appended to' : result.action === 'updated' ? 'updated' : 'left unchanged';
  lines.push(`  ${verb} ${result.path}`);
  lines.push(`  ${context.palette.dim(`runs: mint guard scan --staged --fail-on ${failOn}`)}`);
  if (result.previousHookKept && result.action === 'appended') {
    lines.push(`  ${context.palette.dim('the existing hook was kept and the guard block runs first')}`);
  }
  lines.push('');
  lines.push(`  remove it with: ${context.palette.green('mint guard uninstall-hook')}`);
  return { code: 0, stdout: `${lines.join('\n')}\n`, stderr: '' };
}

function uninstallHookCommand(context: GuardContext): GuardResult {
  const result = uninstallHook(scanRoot(context));
  const lines: string[] = [`${context.palette.bold('mint guard uninstall-hook')}`, ''];
  switch (result.action) {
    case 'deleted':
      lines.push(`  removed ${result.path}`);
      break;
    case 'updated':
      lines.push(`  removed the mint guard block from ${result.path} (the rest of the hook is intact)`);
      break;
    case 'not-found':
      lines.push(`  no pre-commit hook at ${result.path}`);
      break;
    default:
      lines.push(`  ${result.path} does not contain a mint guard block, leaving it alone`);
      break;
  }
  return { code: 0, stdout: `${lines.join('\n')}\n`, stderr: '' };
}

// ------------------------------------------------------------ rotate-help
function rotateHelpCommand(context: GuardContext): GuardResult {
  const query = context.positionals[0];
  if (query === undefined) {
    throw new UsageError('rotate-help needs a finding id or rule id', 'example: mint guard rotate-help aws-access-key-id');
  }
  const options = resolveOptions(context, context.root, () => undefined);
  return renderRotateHelp(query, options.rules, context);
}

// ----------------------------------------------------------------- rules
function rulesCommand(context: GuardContext): GuardResult {
  const options = resolveOptions(context, context.root, () => undefined);
  const format = resolveFormat(context.flags);
  if (format !== 'text' && format !== 'json') {
    throw new UsageError(`mint guard rules supports --format text or json (got "${format}")`);
  }

  const rawSeverities = context.flags
    .getString('severity')
    ?.split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value !== '');
  if (rawSeverities !== undefined && rawSeverities.length > 0) {
    const unknown = rawSeverities.filter((value) => !isSeverity(value));
    if (unknown.length > 0) {
      throw new UsageError(`unknown severity: ${unknown.join(', ')}`, 'use low, medium, high or critical');
    }
  }
  return renderRuleTable(options.rules, context, format === 'json', rawSeverities);
}

export const GUARD_COMMANDS: readonly GuardCommand[] = [
  {
    name: 'scan',
    summary: 'Find leaked secrets in the working tree, the git index, a diff or history',
    usage: 'scan [path] [--staged | --history [--since <rev>] | --diff <rev>] [--fail-on medium]',
    details: [
      'A path may be a directory or a single file. Git modes only report files under that path.',
      'Respects .gitignore, .mintguardignore and .mintguard.json; skips node_modules, .git,',
      'build output, lockfiles and binary files. Exit codes: 0 clean, 1 findings, 2 error.',
      '--verbose lists every skipped file and the reason on stderr.',
    ],
    examples: [
      'mint guard scan',
      'mint guard scan src/config.ts',
      'mint guard scan --staged',
      'mint guard scan --history --since "2 weeks ago"',
      'mint guard scan --diff origin/main',
      'mint guard scan --exit-zero --format json',
      'mint guard scan --format sarif > mintguard.sarif',
    ],
    flags: [
      'staged',
      'history',
      'diff',
      'since',
      'fail-on',
      'exit-zero',
      'format',
      'entropy-threshold',
      'max-file-size',
      'include-lockfiles',
      'gitignore',
      'baseline',
      'baseline-file',
      'config',
      'rules',
      'fix',
      'quiet',
      'verbose',
      'inline-comments',
    ],
    run: scanCommand,
  },
  {
    name: 'check',
    summary: 'Identify a single value: does it look like a secret, and what should I do?',
    usage: 'check [value]  (or pipe the value on stdin)',
    details: [
      'Runs the same rules as scan against one string, so you can triage a value you',
      'found in a log, a chat or a config file without scanning a whole project.',
      'Prefer stdin: a value passed as an argument ends up in your shell history.',
      'Exit codes: 0 not recognised, 1 findings at or above --fail-on, 2 error.',
    ],
    examples: ['mint guard check "sk_live_..."', 'pbpaste | mint guard check', 'mint guard check --json < token.txt'],
    flags: ['fail-on', 'format', 'entropy-threshold', 'config', 'rules', 'quiet'],
    run: checkCommand,
  },
  {
    name: 'env',
    summary: 'Check .env hygiene: tracked or unignored env files, missing examples',
    usage: 'env [path] [--format text|json|sarif|markdown]',
    details: [
      'Reports .env files that git tracks or would commit, a missing .env.example, and',
      'example files that contain real-looking values instead of placeholders.',
    ],
    examples: ['mint guard env', 'mint guard env --format json'],
    flags: ['fail-on', 'exit-zero', 'format', 'baseline', 'baseline-file', 'config', 'quiet'],
    run: envCommand,
  },
  {
    name: 'baseline',
    summary: 'Record current findings so only new leaks fail future scans',
    usage: 'baseline [path] [--prune] [--baseline-file .mintguard-baseline.json]',
    details: [
      'Stores a salted hash per finding - never the secret itself. Re-run it after a',
      'deliberate, reviewed secret to keep the gate focused on new leaks.',
      '--prune drops entries whose finding no longer exists, keeping the file tidy.',
    ],
    examples: ['mint guard baseline', 'mint guard baseline --prune', 'mint guard baseline --baseline-file .guard-baseline.json'],
    flags: ['baseline-file', 'config', 'quiet', 'prune'],
    run: baselineCommand,
  },
  {
    name: 'init',
    summary: 'Create .mintguard.json and .mintguardignore',
    usage: 'init [path] [--force]',
    examples: ['mint guard init'],
    flags: ['force', 'quiet'],
    run: initCommand,
  },
  {
    name: 'install-hook',
    summary: 'Install a git pre-commit hook that scans staged changes',
    usage: 'install-hook [--fail-on medium] [--force]',
    details: [
      'Never replaces an existing hook without --force; with --force the guard block is',
      'inserted after the shebang so it runs before any existing exit.',
    ],
    examples: ['mint guard install-hook', 'mint guard install-hook --fail-on high'],
    flags: ['force', 'fail-on', 'quiet'],
    run: installHookCommand,
  },
  {
    name: 'uninstall-hook',
    summary: 'Remove the mint guard block from the pre-commit hook',
    usage: 'uninstall-hook',
    examples: ['mint guard uninstall-hook'],
    flags: ['quiet'],
    run: uninstallHookCommand,
  },
  {
    name: 'rotate-help',
    summary: 'Show rotation steps and the mint command for a finding or rule',
    usage: 'rotate-help <finding-id|rule-id>',
    examples: ['mint guard rotate-help aws-access-key-id', 'mint guard rotate-help stripe-secret-key-1a2b3c4d'],
    flags: [],
    run: rotateHelpCommand,
  },
  {
    name: 'rules',
    summary: 'List every detection rule with its severity and replacement command',
    usage: 'rules [--format text|json]',
    examples: ['mint guard rules', 'mint guard rules --severity critical,high', 'mint guard rules --format json'],
    flags: ['format', 'severity'],
    run: rulesCommand,
  },
];
