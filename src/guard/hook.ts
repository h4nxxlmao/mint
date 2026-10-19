import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { UsageError } from '../errors.js';
import { gitPath, requireRepo } from './git.js';
import type { Severity } from './types.js';

/**
 * Pre-commit hook management. mint guard never overwrites somebody else's hook
 * without `--force`, and even then it appends a marked block instead of replacing
 * the file, so the previous hook keeps running.
 */

export const HOOK_START = '# >>> mint guard >>>';
export const HOOK_END = '# <<< mint guard <<<';

export function hookPath(root: string): string {
  const configured = gitPath(root, 'hooks');
  const directory = isAbsolute(configured) ? configured : join(root, configured);
  return join(directory, 'pre-commit');
}

export function hookBlock(failOn: Severity): string {
  return [
    HOOK_START,
    '# Blocks commits that contain leaked secrets. Installed by "mint guard install-hook".',
    '# Remove the block (or run "mint guard uninstall-hook") to disable it.',
    `guard_fail_on="${failOn}"`,
    'if command -v mint >/dev/null 2>&1 && mint guard --help >/dev/null 2>&1; then',
    '  mint guard scan --staged --fail-on "$guard_fail_on" || {',
    '    echo "mint guard: commit blocked - rotate the exposed secret, then re-stage the fix." >&2',
    '    exit 1',
    '  }',
    'elif [ -x "./node_modules/.bin/mint" ] && ./node_modules/.bin/mint guard --help >/dev/null 2>&1; then',
    '  ./node_modules/.bin/mint guard scan --staged --fail-on "$guard_fail_on" || {',
    '    echo "mint guard: commit blocked - rotate the exposed secret, then re-stage the fix." >&2',
    '    exit 1',
    '  }',
    'else',
    '  echo "mint guard: not installed, skipping secret scan (npm i -g @npm-install-hanx/mint)" >&2',
    'fi',
    HOOK_END,
  ].join('\n');
}

function replaceBlock(content: string, block: string): string | undefined {
  const start = content.indexOf(HOOK_START);
  if (start === -1) return undefined;
  const endIndex = content.indexOf(HOOK_END, start);
  const end = endIndex === -1 ? content.length : endIndex + HOOK_END.length;
  return `${content.slice(0, start)}${block}${content.slice(end)}`;
}

function stripBlock(content: string): string {
  const start = content.indexOf(HOOK_START);
  if (start === -1) return content;
  const endIndex = content.indexOf(HOOK_END, start);
  const end = endIndex === -1 ? content.length : endIndex + HOOK_END.length;
  return `${content.slice(0, start)}${content.slice(end)}`.replace(/\n{3,}/gu, '\n\n');
}

function makeExecutable(path: string): void {
  try {
    chmodSync(path, 0o755);
  } catch {
    // Windows does not use POSIX modes; git will run the hook through sh anyway.
  }
}

export type HookAction = 'created' | 'updated' | 'appended' | 'unchanged';

export interface HookInstallResult {
  path: string;
  action: HookAction;
  previousHookKept: boolean;
}

export function installHook(root: string, failOn: Severity, force: boolean): HookInstallResult {
  const repo = requireRepo(root, 'installing a hook');
  const path = hookPath(repo);
  const block = hookBlock(failOn);

  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `#!/bin/sh\n\n${block}\n`, 'utf8');
    makeExecutable(path);
    return { path, action: 'created', previousHookKept: false };
  }

  const existing = readFileSync(path, 'utf8');
  const replaced = replaceBlock(existing, block);
  if (replaced !== undefined) {
    if (replaced === existing) return { path, action: 'unchanged', previousHookKept: true };
    writeFileSync(path, replaced, 'utf8');
    makeExecutable(path);
    return { path, action: 'updated', previousHookKept: true };
  }

  if (!force) {
    throw new UsageError(
      `a pre-commit hook already exists at ${path}`,
      're-run with --force to keep it and insert the mint guard block after the shebang',
    );
  }

  // Insert right after the shebang so an existing `exit 0` cannot skip the guard.
  const lines = existing.split(/\r?\n/u);
  const hasShebang = lines[0]?.startsWith('#!') === true;
  const head = hasShebang ? `${lines[0]}\n` : '#!/bin/sh\n';
  const rest = (hasShebang ? lines.slice(1) : lines).join('\n').replace(/^\n+/u, '');
  writeFileSync(path, `${head}\n${block}\n\n${rest}`, 'utf8');
  makeExecutable(path);
  return { path, action: 'appended', previousHookKept: true };
}

export type UninstallAction = 'deleted' | 'updated' | 'not-found' | 'not-ours';

export interface HookUninstallResult {
  path: string;
  action: UninstallAction;
}

export function uninstallHook(root: string): HookUninstallResult {
  const repo = requireRepo(root, 'removing a hook');
  const path = hookPath(repo);
  if (!existsSync(path)) return { path, action: 'not-found' };

  const existing = readFileSync(path, 'utf8');
  if (!existing.includes(HOOK_START)) return { path, action: 'not-ours' };

  const stripped = stripBlock(existing).trim();
  if (stripped === '' || stripped === '#!/bin/sh' || stripped === '#!/usr/bin/env sh') {
    rmSync(path, { force: true });
    return { path, action: 'deleted' };
  }
  writeFileSync(path, `${stripped}\n`, 'utf8');
  makeExecutable(path);
  return { path, action: 'updated' };
}

export function readHook(root: string): string | undefined {
  const repo = requireRepo(root, 'reading hooks');
  const path = hookPath(repo);
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
}
