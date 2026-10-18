/**
 * Portable test runner: collects the compiled test files itself, so `npm test`
 * behaves the same on Windows, macOS and Linux, and on Node 18 through 26
 * (some Node versions do not accept a directory as a --test argument).
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const directory = fileURLToPath(new URL('../dist-test/test/', import.meta.url));
const files = readdirSync(directory)
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => join(directory, name));

if (files.length === 0) {
  console.error('no compiled test files found - run "npm run pretest" first');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
