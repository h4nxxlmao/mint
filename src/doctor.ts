import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { Palette } from './colors.js';
import { readBaseline } from './guard/baseline.js';
import { CONFIG_FILENAME, loadConfig } from './guard/config.js';
import { gitAvailable } from './guard/git.js';
import { VERSION } from './version.js';

/** `mint doctor`: a quick health check of the environment mint runs in. */

export type CheckStatus = 'ok' | 'warn' | 'fail';

export interface DoctorCheck {
  name: string;
  status: CheckStatus;
  detail: string;
}

function clipboardHelpers(): string[] {
  if (process.platform === 'darwin') return ['pbcopy'];
  if (process.platform === 'win32') return ['clip'];
  return ['wl-copy', 'xclip', 'xsel'];
}

export function commandExists(command: string): boolean {
  const result =
    process.platform === 'win32'
      ? spawnSync('where', [command], { windowsHide: true, stdio: 'ignore' })
      : spawnSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' });
  return (result.status ?? -1) === 0;
}

export function runDoctor(cwd: string): { checks: DoctorCheck[]; code: number } {
  const checks: DoctorCheck[] = [];
  checks.push({ name: 'mint', status: 'ok', detail: `v${VERSION}` });

  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  checks.push({
    name: 'node',
    status: major >= 18 ? 'ok' : 'fail',
    detail: `${process.version}${major >= 18 ? '' : ' (mint needs >= 18)'}`,
  });

  // A live CSPRNG check: draw fresh bytes and confirm they look random.
  const sample = randomBytes(32);
  const healthy = sample.length === 32 && new Set(sample).size >= 8;
  checks.push({
    name: 'csprng',
    status: healthy ? 'ok' : 'fail',
    detail: healthy ? 'crypto.randomBytes produced 32 healthy bytes' : 'unexpected output from crypto.randomBytes',
  });

  const helpers = clipboardHelpers();
  const available = helpers.find((command) => commandExists(command));
  checks.push({
    name: 'clipboard',
    status: available === undefined ? 'warn' : 'ok',
    detail: available === undefined ? `no helper found (looked for ${helpers.join(', ')})` : `${available} available for --copy`,
  });

  const git = gitAvailable();
  checks.push({
    name: 'git',
    status: git ? 'ok' : 'warn',
    detail: git ? 'available (guard can scan --staged, --diff and --history)' : 'not found (guard git modes are unavailable)',
  });

  const configPath = join(cwd, CONFIG_FILENAME);
  if (!existsSync(configPath)) {
    checks.push({
      name: 'config',
      status: 'ok',
      detail: `no ${CONFIG_FILENAME} (built-in defaults apply)`,
    });
  } else {
    try {
      loadConfig(cwd);
      checks.push({ name: 'config', status: 'ok', detail: `${CONFIG_FILENAME} is valid` });
    } catch (error) {
      checks.push({
        name: 'config',
        status: 'warn',
        detail: `${CONFIG_FILENAME} is invalid: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  try {
    const config = loadConfig(cwd);
    const baselinePath = isAbsolute(config.baselineFile) ? config.baselineFile : join(cwd, config.baselineFile);
    if (existsSync(baselinePath)) {
      try {
        const baseline = readBaseline(baselinePath);
        checks.push({
          name: 'baseline',
          status: 'ok',
          detail: `${String(baseline?.findings.length ?? 0)} known finding hash(es)`,
        });
      } catch (error) {
        checks.push({
          name: 'baseline',
          status: 'warn',
          detail: `invalid baseline file: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
  } catch {
    // An invalid config is already reported above; nothing more to check here.
  }

  return { checks, code: checks.some((check) => check.status === 'fail') ? 1 : 0 };
}

function statusLabel(status: CheckStatus, palette: Palette): string {
  if (status === 'ok') return palette.green('ok  ');
  if (status === 'warn') return palette.yellow('warn');
  return palette.red('fail');
}

export function renderDoctor(checks: readonly DoctorCheck[], format: 'text' | 'json', palette: Palette): string {
  if (format === 'json') {
    return `${JSON.stringify({ version: VERSION, ok: !checks.some((check) => check.status === 'fail'), checks }, null, 2)}\n`;
  }
  const width = Math.max(...checks.map((check) => check.name.length)) + 2;
  const lines: string[] = [palette.bold('mint doctor'), ''];
  for (const check of checks) {
    lines.push(`  ${statusLabel(check.status, palette)}  ${check.name.padEnd(width)}${palette.dim(check.detail)}`);
  }
  const failed = checks.filter((check) => check.status === 'fail').length;
  lines.push('');
  lines.push(failed === 0 ? palette.green('everything mint needs is available') : palette.red(`${String(failed)} required check(s) failed`));
  return `${lines.join('\n')}\n`;
}
