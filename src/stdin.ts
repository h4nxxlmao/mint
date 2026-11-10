import { readFileSync } from 'node:fs';

/**
 * Read piped stdin as a list of non-empty lines.
 *
 * Only the CLI calls this, and only when a command needs items and none were given:
 * a library call must never block waiting on a terminal.
 */
export function readStdinLines(): string[] {
  if (process.stdin.isTTY) return [];
  try {
    return readFileSync(0, 'utf8')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line !== '');
  } catch {
    return [];
  }
}

/** Whole stdin, trimmed; used by `inspect` and `guard check`. */
export function readStdinText(): string {
  if (process.stdin.isTTY) return '';
  try {
    return readFileSync(0, 'utf8').trim();
  } catch {
    return '';
  }
}
