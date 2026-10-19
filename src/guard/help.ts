import type { Palette } from '../colors.js';
import type { FlagSpec } from '../flags.js';
import { GLOBAL_FLAGS, specFor } from '../specs.js';
import { VERSION } from '../version.js';
import type { GuardCommand } from './types.js';

function flagLabel(spec: FlagSpec): string {
  const short = spec.alias ? `-${spec.alias}, ` : '';
  return `${short}${spec.shownAs ?? `--${spec.name}`}${spec.arg ? ` ${spec.arg}` : ''}`;
}

function flagTable(specs: readonly FlagSpec[], palette: Palette): string[] {
  if (specs.length === 0) return ['  (none)'];
  const rows = specs.map((spec) => [flagLabel(spec), spec.description] as const);
  const width = Math.max(...rows.map(([label]) => label.length));
  return rows.map(([label, description]) => `  ${palette.cyan(label.padEnd(width))}  ${palette.dim(description)}`);
}

export function renderGuardHelp(commands: readonly GuardCommand[], palette: Palette): string {
  const width = Math.max(...commands.map((command) => command.name.length)) + 2;
  const lines: string[] = [];
  lines.push(`${palette.bold('mint guard')} ${palette.dim(`- find leaked secrets before they leave your machine (v${VERSION})`)}`);
  lines.push('');
  lines.push(`${palette.dim('generate with mint, protect with mint guard')}`);
  lines.push('');
  lines.push(palette.bold('usage'));
  lines.push('  mint guard <command> [path] [options]');
  lines.push('');
  lines.push(palette.bold('commands'));
  for (const command of commands) {
    lines.push(`  ${palette.green(command.name.padEnd(width))}${command.summary}`);
    const example = command.examples[0];
    if (example) lines.push(`  ${' '.repeat(width)}${palette.dim(example)}`);
  }
  lines.push('');
  lines.push(palette.bold('common options'));
  lines.push(
    ...flagTable(
      [
        specFor('fail-on'),
        specFor('format'),
        specFor('max-file-size'),
        specFor('entropy-threshold'),
        specFor('baseline'),
        specFor('config'),
        specFor('quiet'),
      ].filter((spec): spec is FlagSpec => spec !== undefined),
      palette,
    ),
  );
  lines.push('');
  lines.push(`${palette.dim('offline by design: no network calls, no telemetry, no secrets written to disk.')}`);
  lines.push(`${palette.dim('mint guard <command> --help')} ${palette.dim('shows the flags of one command.')}`);
  return `${lines.join('\n')}\n`;
}

export function renderGuardCommandHelp(command: GuardCommand, palette: Palette): string {
  const lines: string[] = [];
  lines.push(palette.bold(`mint guard ${command.usage.replace(/^mint guard /u, '')}`));
  lines.push(`  ${command.summary}`);
  lines.push('');
  if (command.details && command.details.length > 0) {
    for (const detail of command.details) lines.push(`  ${detail}`);
    lines.push('');
  }
  lines.push(palette.bold('usage'));
  lines.push(`  mint guard ${command.usage.replace(/^mint guard /u, '')}`);
  lines.push('');
  if (command.examples.length > 0) {
    lines.push(palette.bold('examples'));
    for (const example of command.examples) lines.push(`  ${palette.green(example)}`);
    lines.push('');
  }
  const own = command.flags
    .map((name) => specFor(name))
    .filter((spec): spec is FlagSpec => spec !== undefined && !GLOBAL_FLAGS.some((global) => global.name === spec.name));
  lines.push(palette.bold('options'));
  lines.push(...flagTable(own, palette));
  lines.push('');
  lines.push(palette.bold('global options'));
  lines.push(...flagTable(GLOBAL_FLAGS.filter((spec) => spec.name !== 'help'), palette));
  lines.push('');
  lines.push(`${palette.dim('mint guard --help')} ${palette.dim('lists every guard command.')}`);
  return `${lines.join('\n')}\n`;
}
