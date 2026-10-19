import { spawn, spawnSync } from 'node:child_process';
import { RuntimeError, UsageError } from '../errors.js';
import type { CommitInfo } from './types.js';

/**
 * Everything mint guard knows about git. Read-only by design: the only write is the
 * pre-commit hook, and that lives in hook.ts.
 */

export interface GitResult {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
}

export function runGit(args: readonly string[], cwd: string): GitResult {
  const result = spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) {
    return { ok: false, code: -1, stdout: '', stderr: result.error.message };
  }
  return {
    ok: (result.status ?? -1) === 0,
    code: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function gitAvailable(): boolean {
  const result = spawnSync('git', ['--version'], { encoding: 'utf8', windowsHide: true });
  return result.error === undefined && (result.status ?? -1) === 0;
}

export function requireGit(): void {
  if (!gitAvailable()) {
    throw new RuntimeError('git is not available on PATH, which this command needs');
  }
}

export function repoRoot(cwd: string): string | undefined {
  const result = runGit(['rev-parse', '--show-toplevel'], cwd);
  return result.ok ? result.stdout.trim() : undefined;
}

export function requireRepo(cwd: string, what = 'this command'): string {
  requireGit();
  const root = repoRoot(cwd);
  if (root === undefined) {
    throw new RuntimeError(`not inside a git repository, which ${what} needs`, new Error('git rev-parse failed'));
  }
  return root;
}

/** Paths in the index that differ from HEAD (added, copied, modified, renamed). */
export function stagedPaths(root: string): string[] {
  const result = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], root);
  if (!result.ok) throw new RuntimeError(`git diff failed: ${result.stderr.trim()}`);
  return result.stdout.split('\u0000').filter((path) => path !== '');
}

/** Content of a staged file as it will be committed. */
export function stagedContent(root: string, path: string): string | undefined {
  const result = runGit(['show', `:${path}`], root);
  return result.ok ? result.stdout : undefined;
}

export function trackedPaths(root: string): Set<string> {
  const result = runGit(['ls-files', '-z'], root);
  if (!result.ok) return new Set();
  return new Set(result.stdout.split('\u0000').filter((path) => path !== ''));
}

/** True when the path is matched by gitignore rules (tracked files are not ignored). */
export function isIgnoredByGit(root: string, path: string): boolean {
  const result = runGit(['check-ignore', '-q', '--', path], root);
  return result.ok;
}

export function gitPath(root: string, name: string): string {
  const result = runGit(['rev-parse', '--git-path', name], root);
  return result.ok ? result.stdout.trim() : name;
}

export function headCommit(root: string): string | undefined {
  const result = runGit(['rev-parse', '--short', 'HEAD'], root);
  return result.ok ? result.stdout.trim() : undefined;
}

/**
 * `--since` accepts either a revision (scans `<rev>..HEAD`) or anything git accepts
 * as a date ("2 weeks ago", "2024-01-01").
 */
export function resolveSince(root: string, value: string): string[] {
  const looksLikeObject = /^[0-9a-f]{7,40}$/iu.test(value) || runGit(['rev-parse', '--verify', '--quiet', value], root).ok;
  if (looksLikeObject) return [`${value}..HEAD`];
  if (/^\d{4}-\d{2}-\d{2}/u.test(value) || /ago$|\bweek|\bmonth|\byear|\byesterday|\btoday/iu.test(value)) {
    return [`--since=${value}`];
  }
  throw new UsageError(`--since "${value}" is neither a revision nor a date`, 'try --since HEAD~20 or --since "2 weeks ago"');
}

export interface HistoryHandlers {
  /** Called once per added line, with the line number in the new file. */
  scanLine(line: string, lineNumber: number, file: string, commit: CommitInfo): void;
  onCommit?: (commit: CommitInfo) => void;
}

export interface HistoryOptions {
  /** Extra git arguments, e.g. `['HEAD~20..HEAD']` or `['--since=2 weeks ago']`. */
  sinceArgs?: readonly string[];
  maxCommits?: number;
}

export interface HistorySummary {
  commits: number;
  files: number;
}

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/u;

function unquotePath(raw: string): string {
  let path = raw;
  if (path.startsWith('"') && path.endsWith('"') && path.length > 1) {
    path = path
      .slice(1, -1)
      .replace(/\\"/gu, '"')
      .replace(/\\\\/gu, '\\')
      .replace(/\\([0-7]{3})/gu, (_, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)));
  }
  return path.startsWith('b/') ? path.slice(2) : path;
}

class HistoryParser {
  private commit: CommitInfo = { hash: '', author: '', date: '' };
  private file: string | undefined;
  private lineNumber = 0;
  private inHunk = false;
  private skipFile = false;
  commits = 0;
  files = 0;
  private seenFiles = new Set<string>();

  constructor(private readonly handlers: HistoryHandlers, private readonly maxCommits?: number) {}

  private countFile(path: string): void {
    const key = `${this.commit.hash}\u0000${path}`;
    if (!this.seenFiles.has(key)) {
      this.seenFiles.add(key);
      this.files++;
    }
  }

  handle(line: string): void {
    if (line.startsWith('\u001e')) {
      const [hash = '', author = '', date = ''] = line.slice(1).split('\u001f');
      this.commit = { hash, author, date };
      this.commits++;
      this.inHunk = false;
      this.skipFile = false;
      this.file = undefined;
      this.handlers.onCommit?.(this.commit);
      return;
    }
    if (this.maxCommits !== undefined && this.commits > this.maxCommits) {
      this.inHunk = false;
      return;
    }
    if (line.startsWith('diff --git ')) {
      this.inHunk = false;
      this.skipFile = false;
      this.file = undefined;
      return;
    }
    if (line.startsWith('+++ ')) {
      const rest = line.slice(4).trim();
      if (rest === '/dev/null' || rest === '') {
        this.skipFile = true;
        this.file = undefined;
        return;
      }
      this.file = unquotePath(rest);
      this.skipFile = false;
      this.countFile(this.file);
      return;
    }
    if (line.startsWith('@@')) {
      const match = HUNK.exec(line);
      if (match === null || this.skipFile || this.file === undefined) {
        this.inHunk = false;
        return;
      }
      this.lineNumber = Number(match[1]);
      this.inHunk = true;
      return;
    }
    if (!this.inHunk) return;

    if (line.startsWith('+')) {
      const file = this.file;
      if (file !== undefined) this.handlers.scanLine(line.slice(1), this.lineNumber, file, this.commit);
      this.lineNumber++;
      return;
    }
    if (line.startsWith('-') || line.startsWith('\\')) return;
    this.inHunk = false;
  }
}

/**
 * Stream `git log -p` and hand every added line to the callback. Parsing is
 * incremental with a bounded buffer, so a huge repository does not have to fit in
 * memory.
 */
export function streamHistory(
  root: string,
  options: HistoryOptions,
  handlers: HistoryHandlers,
): Promise<HistorySummary> {
  const args = [
    '-C',
    root,
    'log',
    '--all',
    '--no-color',
    '--date=short',
    '--pretty=format:%x1e%H%x1f%an%x1f%ad',
    '-p',
    '--unified=0',
  ];
  if (options.sinceArgs !== undefined) args.push(...options.sinceArgs);
  if (options.maxCommits !== undefined) args.push(`-n${String(options.maxCommits)}`);

  return new Promise<HistorySummary>((resolve, reject) => {
    const parser = new HistoryParser(handlers, options.maxCommits);
    const child = spawn('git', args, { windowsHide: true });
    let stderr = '';
    let pending: Buffer = Buffer.alloc(0);

    child.on('error', (error) => {
      reject(new RuntimeError(`could not run git log: ${error.message}`, error));
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.stdout.on('data', (chunk: Buffer) => {
      pending = pending.length === 0 ? chunk : Buffer.concat([pending, chunk]);
      let index = pending.indexOf(0x0a);
      while (index !== -1) {
        const line = pending.subarray(0, index).toString('utf8').replace(/\r$/u, '');
        pending = pending.subarray(index + 1);
        parser.handle(line);
        index = pending.indexOf(0x0a);
      }
    });
    child.on('close', (code) => {
      if (pending.length > 0) parser.handle(pending.toString('utf8').replace(/\r$/u, ''));
      if (code === 0 || /does not have any commits yet/iu.test(stderr)) {
        resolve({ commits: parser.commits, files: parser.files });
        return;
      }
      reject(new RuntimeError(`git log failed (exit ${String(code)}): ${stderr.trim()}`));
    });
  });
}
