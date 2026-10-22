#!/usr/bin/env node
import { buildAliasMap, parseArgs } from './args.js';
import { findTool, renderCatalog, resolveToolFormat } from './catalog.js';
import { paletteFor, type Palette } from './colors.js';
import { renderCompletions, resolveShell } from './completions.js';
import { dispatch } from './dispatch.js';
import { renderDoctor, runDoctor } from './doctor.js';
import { MintError, UsageError } from './errors.js';
import { runGuard, type GuardIo, type GuardResult } from './guard/index.js';
import { renderCommandHelp, renderMainHelp, renderToolHelp } from './help.js';
import { render } from './output.js';
import { findGenerator, GENERATORS } from './registry.js';
import { buildSpecMap } from './specs.js';
import { parseSize, suggest } from './flags.js';
import { VERSION } from './version.js';
import type { Flags } from './flags.js';
import type { GenResult, Generator } from './types.js';

const SPECS = buildSpecMap();
const ALIASES = buildAliasMap(SPECS);
const SIZE_PREFIX = /^\d[A-Za-z0-9]*$/u;
const SIZE_FLAG_NAMES = ['bytes', 'bits', 'length', 'size'] as const;

function write(stream: NodeJS.WriteStream, text: string): void {
  if (text.length === 0) return;
  try {
    stream.write(text);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EPIPE') throw error;
  }
}

function writeBuffer(stream: NodeJS.WriteStream, buffer: Buffer): void {
  try {
    stream.write(buffer);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EPIPE') throw error;
  }
}

/** `--raw`: write the CSPRNG bytes themselves, so `mint 32 --raw > key.bin` works. */
function writeRawResults(results: readonly GenResult[], flags: Flags): number {
  const conflict = ['json', 'env', 'prefix', 'suffix', 'copy'].find((name) => flags.has(name));
  if (conflict !== undefined) {
    throw new UsageError(`--raw cannot be combined with --${conflict}`, 'raw output is meant to be piped into a file');
  }
  for (const result of results) {
    if (result.raw === undefined) {
      throw new UsageError('--raw needs a byte-based size', 'use --bytes or --bits instead of --length');
    }
  }
  for (const result of results) writeBuffer(process.stdout, result.raw!);
  if (flags.getBool('entropy')) {
    const bits = results.reduce((sum, result) => sum + (result.entropyBits ?? 0), 0);
    write(process.stderr, `entropy: ${String(bits)} bits\n`);
  }
  return 0;
}

function fail(error: MintError, palette: Palette): number {
  write(process.stderr, `${palette.red('mint:')} ${error.message}\n`);
  if (error.hint) write(process.stderr, `${palette.dim(`  ${error.hint}`)}\n`);
  return error.exitCode;
}

function unknownCommand(command: string): UsageError {
  const candidates = [...GENERATORS.map((generator) => generator.name), 'guard'];
  const guess = suggest(command, candidates);
  return new UsageError(
    `unknown command "${command}"`,
    guess ? `did you mean "mint ${guess}"?` : 'run "mint --help" to list every generator',
  );
}

/** Guard subcommands use 2 for every failure (docs: 0 clean, 1 findings, 2 error). */
function failGuard(error: MintError, palette: Palette): number {
  write(process.stderr, `${palette.red('mint:')} ${error.message}\n`);
  if (error.hint) write(process.stderr, `${palette.dim(`  ${error.hint}`)}\n`);
  return 2;
}

/** Write a guard result; history scans resolve asynchronously. */
function writeGuardResult(result: GuardResult | Promise<GuardResult>, stderrPalette: Palette): number {
  if (result instanceof Promise) {
    result
      .then((value) => {
        write(process.stdout, value.stdout);
        write(process.stderr, value.stderr);
        process.exitCode = value.code;
      })
      .catch((error: unknown) => {
        if (error instanceof MintError) {
          process.exitCode = failGuard(error, stderrPalette);
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        write(process.stderr, `${stderrPalette.red('mint:')} unexpected error: ${message}\n`);
        process.exitCode = 2;
      });
    return 0;
  }
  write(process.stdout, result.stdout);
  write(process.stderr, result.stderr);
  return result.code;
}

function guardIo(flags: Flags, stdoutPalette: Palette, stderrPalette: Palette): GuardIo {
  return {
    cwd: process.cwd(),
    palette: stdoutPalette,
    progress(message: string) {
      if (process.stderr.isTTY && !flags.getBool('quiet')) {
        write(process.stderr, `${stderrPalette.dim(message)}\n`);
      }
    },
  };
}

/** Guard help is always synchronous (no subcommand means no scan). */
function guardHelpText(flags: Flags, palette: Palette): string {
  const result = runGuard([], flags, { cwd: process.cwd(), palette, progress: () => undefined });
  return result instanceof Promise ? '' : result.stdout;
}

interface Resolution {
  generator: Generator;
  args: string[];
  shorthandSize: number | undefined;
}

function resolveCommand(command: string, positionals: string[]): Resolution {
  const direct = findGenerator(command);
  if (direct) return { generator: direct, args: positionals, shorthandSize: undefined };

  if (SIZE_PREFIX.test(command)) {
    let size: number;
    try {
      size = parseSize(command, 'the shorthand size');
    } catch (error) {
      // A numeric size that is out of range has a specific, useful message
      // ("must be at least 1", "unknown size suffix", ...); keep it.
      if (/^\d+$/u.test(command) && error instanceof UsageError) throw error;
      throw new UsageError(
        `"${command}" does not look like a size`,
        `try mint 32, mint 128 or "mint dice ${command}"`,
      );
    }
    return { generator: findGenerator('bytes')!, args: positionals, shorthandSize: size };
  }
  throw unknownCommand(command);
}

function main(argv: readonly string[]): number {
  const stdoutPalette = paletteFor(process.stdout);
  const stderrPalette = paletteFor(process.stderr);
  const parsed = parseArgs(argv, SPECS, ALIASES);
  const flags = parsed.flags;

  if (flags.getBool('version')) {
    write(process.stdout, `${VERSION}\n`);
    return 0;
  }

  if (parsed.command === 'help') {
    const target = parsed.positionals[0];
    if (target === undefined) {
      write(process.stdout, renderMainHelp(stdoutPalette));
      return 0;
    }
    if (target === 'guard') {
      write(process.stdout, guardHelpText(flags, stdoutPalette));
      return 0;
    }
    const tool = findTool(target);
    if (tool) {
      write(process.stdout, renderToolHelp(tool, stdoutPalette));
      return 0;
    }
    const generator = findGenerator(target);
    if (!generator) throw unknownCommand(target);
    write(process.stdout, renderCommandHelp(generator, stdoutPalette, target));
    return 0;
  }

  if (parsed.command === null) {
    write(process.stdout, renderMainHelp(stdoutPalette));
    return 0;
  }

  if (parsed.command === 'guard') {
    try {
      return writeGuardResult(runGuard(parsed.positionals, flags, guardIo(flags, stdoutPalette, stderrPalette)), stderrPalette);
    } catch (error) {
      if (error instanceof MintError) return failGuard(error, stderrPalette);
      throw error;
    }
  }

  if (parsed.command === 'list') {
    write(process.stdout, renderCatalog(resolveToolFormat(flags)));
    return 0;
  }

  if (parsed.command === 'completions') {
    write(process.stdout, renderCompletions(resolveShell(parsed.positionals[0])));
    return 0;
  }

  if (parsed.command === 'doctor') {
    const report = runDoctor(process.cwd());
    write(process.stdout, renderDoctor(report.checks, resolveToolFormat(flags), stdoutPalette));
    return report.code;
  }

  const { generator, args, shorthandSize } = resolveCommand(parsed.command, parsed.positionals);

  if (flags.getBool('help')) {
    write(process.stdout, renderCommandHelp(generator, stdoutPalette, parsed.command));
    return 0;
  }

  const positionals = [...args];
  if (shorthandSize !== undefined) {
    const conflicting = SIZE_FLAG_NAMES.find((name) => flags.has(name));
    if (conflicting) {
      throw new UsageError(
        `mint ${parsed.command} already sets the size, so --${conflicting} is redundant`,
        'use either "mint 32" or "mint bytes --bytes 32"',
      );
    }
    flags.set('bytes', String(shorthandSize));
  }

  const results = dispatch(generator, flags, positionals);

  if (flags.getBool('raw')) {
    return writeRawResults(results, flags);
  }

  const rendered = render(results, {
    generator: generator.name,
    json: flags.getBool('json'),
    newline: flags.getBool('newline', true),
    copy: flags.getBool('copy'),
    entropy: flags.getBool('entropy'),
    env: flags.getString('env'),
    prefix: flags.getString('prefix'),
    suffix: flags.getString('suffix'),
  });

  write(process.stdout, rendered.stdout);
  write(process.stderr, rendered.stderr);
  return 0;
}

const errorPalette = paletteFor(process.stderr);
try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (error instanceof MintError) {
    process.exitCode = fail(error, errorPalette);
  } else {
    const message = error instanceof Error ? error.message : String(error);
    write(process.stderr, `${errorPalette.red('mint:')} unexpected error: ${message}\n`);
    process.exitCode = 1;
  }
}
