import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { IgnoreSet, parseIgnoreLines } from './gitignore.js';
import type { GuardConfig } from './types.js';

/**
 * Build the ignore state for a scan: `.mintguardignore`, the root `.gitignore`,
 * `.git/info/exclude` and the config `exclude` patterns. Nested `.gitignore` files
 * are added by the walker as it descends.
 */
export function buildIgnoreSet(root: string, config: GuardConfig, useGitignore: boolean): IgnoreSet {
  const ignore = new IgnoreSet();

  if (useGitignore) {
    for (const name of config.ignoreFiles) {
      addIgnoreFile(ignore, isAbsolute(name) ? name : join(root, name), '');
    }
    addIgnoreFile(ignore, join(root, '.gitignore'), '');
    addIgnoreFile(ignore, join(root, '.git', 'info', 'exclude'), '');
  }

  ignore.addPatterns(config.exclude);
  return ignore;
}

function addIgnoreFile(ignore: IgnoreSet, path: string, baseDir: string): void {
  if (!existsSync(path)) return;
  try {
    ignore.addIgnoreFile(baseDir, parseIgnoreLines(readFileSync(path, 'utf8')));
  } catch {
    // unreadable ignore file: ignore it
  }
}
