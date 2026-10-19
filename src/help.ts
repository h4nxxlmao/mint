import type { Palette } from './colors.js';
import type { FlagSpec } from './flags.js';
import { GLOBAL_FLAGS, SIZE_FLAGS, specFor } from './specs.js';
import { CATEGORIES, GENERATORS } from './registry.js';
import { REPO_URL, VERSION } from './version.js';
import type { Generator } from './types.js';

function flagLabel(spec: FlagSpec): string {
  const short = spec.alias ? `-${spec.alias}, ` : '';
  const name = spec.shownAs ?? `--${spec.name}`;
  return `${short}${name}${spec.arg ? ` ${spec.arg}` : ''}`;
}

function renderFlagTable(specs: readonly FlagSpec[], palette: Palette): string[] {
  const rows = specs.map((spec) => [flagLabel(spec), spec.description] as const);
  const width = Math.max(...rows.map(([label]) => label.length));
  return rows.map(([label, description]) => `  ${palette.cyan(label.padEnd(width))}  ${palette.dim(description)}`);
}

function renderGenerator(generator: Generator, palette: Palette, width: number): string[] {
  const name = generator.name.padEnd(width);
  const lines = [`  ${palette.green(name)}${generator.summary}`];
  if (generator.examples?.[0]) {
    lines.push(`  ${' '.repeat(width)}${palette.dim(generator.examples[0])}`);
  }
  return lines;
}

function nameColumnWidth(): number {
  return Math.max(...GENERATORS.map((generator) => generator.name.length)) + 2;
}

export function renderMainHelp(palette: Palette): string {
  const lines: string[] = [];
  const width = nameColumnWidth();
  lines.push(`${palette.bold(`mint ${VERSION}`)} ${palette.dim('- cryptographically secure random secrets, tokens and ids')}`);
  lines.push('');
  lines.push(palette.bold('usage'));
  lines.push(`  mint <command> [options]`);
  lines.push(`  mint ${palette.dim('<n>')} [--base64 | --base58 | ...]   ${palette.dim('shorthand for mint bytes --bytes <n>')}`);
  lines.push('');
  lines.push(palette.bold('generators'));

  for (const category of CATEGORIES) {
    lines.push(`  ${palette.bold(category.title)}`);
    for (const generator of category.generators) lines.push(...renderGenerator(generator, palette, width));
    lines.push('');
  }

  lines.push(palette.bold('protect'));
  lines.push(`  ${palette.green('guard'.padEnd(width))}${'Find leaked secrets and risky files in a project'}`);
  lines.push(`  ${' '.repeat(width)}${palette.dim('mint guard scan --staged')}`);
  lines.push('');

  lines.push(palette.bold('common options'));
  lines.push(...renderFlagTable([...SIZE_FLAGS, ...GLOBAL_FLAGS.filter((spec) => spec.name !== 'help' && spec.name !== 'version')], palette));
  lines.push('');
  lines.push(palette.bold('examples'));
  lines.push(`  mint uuid`);
  lines.push(`  mint password --length 32 --copy`);
  lines.push(`  mint passphrase --words 6 --separator -`);
  lines.push(`  mint jwt-secret --algo hs512 --env JWT_SECRET`);
  lines.push(`  mint nanoid --size 12 --count 5 --json`);
  lines.push(`  mint 32 --base58`);
  lines.push(`  echo "$(mint aes --iv --format base64)"`);
  lines.push(`  mint guard scan --staged`);
  lines.push('');
  lines.push(`${palette.dim('Every value comes from node:crypto (CSPRNG) with rejection sampling - never Math.random().')}`);
  lines.push(`${palette.bold('generate with mint, protect with mint guard.')}`);
  lines.push(`${palette.dim('Run')} mint <command> --help ${palette.dim('for a single generator,')} mint guard --help ${palette.dim('for the scanner.')}`);
  lines.push(`${palette.dim(REPO_URL)}`);
  return `${lines.join('\n')}\n`;
}

export function renderCommandHelp(generator: Generator, palette: Palette, invokedAs: string): string {
  const lines: string[] = [];
  const usage = generator.usage ?? generator.name;
  lines.push(`${palette.bold(`mint ${invokedAs === generator.name ? usage : invokedAs}`)}`);
  lines.push(`  ${generator.summary}`);
  lines.push('');

  if (generator.details?.length) {
    for (const detail of generator.details) lines.push(`  ${detail}`);
    lines.push('');
  }

  lines.push(palette.bold('usage'));
  lines.push(`  mint ${usage}`);
  lines.push('');

  if (generator.examples?.length) {
    lines.push(palette.bold('examples'));
    for (const example of generator.examples) lines.push(`  ${palette.green(example)}`);
    lines.push('');
  }

  const own = (generator.flags ?? [])
    .map((name) => specFor(name))
    .filter((spec): spec is FlagSpec => spec !== undefined && !isGlobal(spec.name));
  if (own.length > 0) {
    lines.push(palette.bold('options'));
    lines.push(...renderFlagTable(own, palette));
    lines.push('');
  }

  lines.push(palette.bold('global options'));
  lines.push(...renderFlagTable(GLOBAL_FLAGS.filter((spec) => spec.name !== 'help'), palette));
  lines.push('');
  lines.push(`${palette.dim('mint --help')} ${palette.dim('lists every generator.')}`);
  return `${lines.join('\n')}\n`;
}

function isGlobal(name: string): boolean {
  return GLOBAL_FLAGS.some((spec) => spec.name === name);
}
