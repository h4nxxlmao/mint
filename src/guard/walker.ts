import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { IgnoreSet, parseIgnoreLines } from './gitignore.js';

/**
 * Directory walking: default skips, nested .gitignore support, binary sniffing,
 * a file size cap and deterministic (sorted) order.
 */

export const DEFAULT_SKIP_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.output',
  '.vercel',
  '.netlify',
  'vendor',
  'target',
  '__pycache__',
  '.venv',
  'venv',
  '.tox',
  '.mypy_cache',
  '.pytest_cache',
  '.ruff_cache',
  '.cache',
  '.turbo',
  '.parcel-cache',
  '.idea',
  '.vscode',
  '.terraform',
  '.gradle',
  '.dart_tool',
  'Pods',
  'DerivedData',
  'tmp',
]);

export const LOCKFILES: ReadonlySet<string> = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'bun.lock',
  'composer.lock',
  'Cargo.lock',
  'Gemfile.lock',
  'poetry.lock',
  'Pipfile.lock',
  'go.sum',
  'packages.lock.json',
  'mix.lock',
  'pubspec.lock',
  'gradle.lockfile',
  'flake.lock',
]);

const BINARY_EXTENSIONS: ReadonlySet<string> = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'icns', 'tiff', 'avif',
  'pdf', 'zip', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar', 'jar', 'war', 'whl', 'snap',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'mp3', 'mp4', 'm4a', 'mov', 'avi', 'mkv', 'webm', 'wav', 'ogg', 'flac',
  'so', 'dylib', 'dll', 'exe', 'bin', 'node', 'wasm', 'class', 'pyc', 'pyo', 'o', 'a', 'lib',
  'sqlite', 'sqlite3', 'db', 'mdb', 'pdb', 'dat', 'pkl', 'npy', 'npz', 'parquet',
  'lockb', 'p12', 'pfx', 'jks', 'keystore', 'der', 'img', 'iso',
]);

export type SkipReason =
  | 'default-dir'
  | 'ignored'
  | 'lockfile'
  | 'binary-extension'
  | 'binary-content'
  | 'too-large'
  | 'symlink'
  | 'unreadable'
  | 'excluded';

export type WalkEvent =
  | { type: 'file'; path: string; absolute: string; size: number }
  | { type: 'skip'; path: string; reason: SkipReason };

export interface WalkOptions {
  /** Absolute directory to walk. */
  root: string;
  maxFileSize: number;
  includeLockfiles: boolean;
  /** Shared ignore set; nested .gitignore files are added as the walk descends. */
  ignore: IgnoreSet;
  /** When false, .gitignore files are not read at all. */
  useGitignore?: boolean;
  extraSkipFiles?: readonly string[];
}

function toPosix(path: string): string {
  return sep === '/' ? path : path.split(sep).join('/');
}

/** Load a nested .gitignore so its rules apply to that subtree. */
function loadNestedIgnore(ignore: IgnoreSet, absoluteDir: string, relativeDir: string): void {
  try {
    const content = readFileSync(join(absoluteDir, '.gitignore'), 'utf8');
    ignore.addIgnoreFile(relativeDir, parseIgnoreLines(content));
  } catch {
    // no .gitignore here
  }
}

export function looksBinary(bytes: Buffer): boolean {
  const limit = Math.min(bytes.length, 8000);
  for (let index = 0; index < limit; index++) {
    if (bytes[index] === 0) return true;
  }
  // UTF-16 without a NUL in the sample still shows up as lots of interleaved zeros,
  // which the loop above already catches; BOM check covers the empty-ish cases.
  return false;
}

function extensionOf(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot + 1).toLowerCase();
}

/**
 * Walk the tree depth first, yielding files to scan and skips for the summary.
 * Directories that are ignored are never descended into (git semantics: a negation
 * inside an ignored directory does not resurrect it).
 */
export function* walkFiles(options: WalkOptions): Generator<WalkEvent> {
  const useGitignore = options.useGitignore ?? true;
  const extraSkip = new Set(options.extraSkipFiles ?? []);
  const stack: string[] = [''];

  while (stack.length > 0) {
    const relativeDir = stack.pop()!;
    const absoluteDir = relativeDir === '' ? options.root : join(options.root, relativeDir);

    let entries;
    try {
      entries = readdirSync(absoluteDir, { withFileTypes: true });
    } catch {
      if (relativeDir !== '') yield { type: 'skip', path: relativeDir, reason: 'unreadable' };
      continue;
    }

    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

    const childDirs: string[] = [];
    for (const entry of entries) {
      const relativePath = relativeDir === '' ? entry.name : `${relativeDir}/${entry.name}`;

      if (entry.isSymbolicLink()) {
        yield { type: 'skip', path: relativePath, reason: 'symlink' };
        continue;
      }

      if (entry.isDirectory()) {
        if (DEFAULT_SKIP_DIRS.has(entry.name)) {
          yield { type: 'skip', path: relativePath, reason: 'default-dir' };
          continue;
        }
        if (options.ignore.ignores(relativePath, true)) {
          yield { type: 'skip', path: relativePath, reason: 'ignored' };
          continue;
        }
        if (extraSkip.has(entry.name)) {
          yield { type: 'skip', path: relativePath, reason: 'excluded' };
          continue;
        }
        childDirs.push(relativePath);
        if (useGitignore) loadNestedIgnore(options.ignore, join(absoluteDir, entry.name), relativePath);
        continue;
      }

      if (!entry.isFile()) continue;

      if (extraSkip.has(entry.name)) {
        yield { type: 'skip', path: relativePath, reason: 'excluded' };
        continue;
      }
      if (options.ignore.ignores(relativePath, false)) {
        yield { type: 'skip', path: relativePath, reason: 'ignored' };
        continue;
      }
      if (!options.includeLockfiles && LOCKFILES.has(entry.name)) {
        yield { type: 'skip', path: relativePath, reason: 'lockfile' };
        continue;
      }
      if (BINARY_EXTENSIONS.has(extensionOf(entry.name))) {
        yield { type: 'skip', path: relativePath, reason: 'binary-extension' };
        continue;
      }

      const absolute = join(absoluteDir, entry.name);
      let size: number;
      try {
        size = statSync(absolute).size;
      } catch {
        yield { type: 'skip', path: relativePath, reason: 'unreadable' };
        continue;
      }
      if (size > options.maxFileSize) {
        yield { type: 'skip', path: relativePath, reason: 'too-large' };
        continue;
      }

      yield { type: 'file', path: relativePath, absolute, size };
    }

    // Depth-first with sorted output: push in reverse so the first child is popped first.
    for (let index = childDirs.length - 1; index >= 0; index--) {
      stack.push(childDirs[index]);
    }
  }
}

export function relativeTo(root: string, absolutePath: string): string {
  return toPosix(relative(root, absolutePath));
}
