#!/usr/bin/env node
import { buildAliasMap, parseArgs } from './args.js';
import { paletteFor, type Palette } from './colors.js';
import { dispatch } from './dispatch.js';
import { MintError, UsageError } from './errors.js';
import { renderCommandHelp, renderMainHelp } from './help.js';
import { render } from './output.js';
import { findGenerator, GENERATORS } from './registry.js';
import { buildSpecMap } from './specs.js';
import { parseSize, suggest } from './flags.js';
import { VERSION } from './version.js';
import type { Generator } from './types.js';

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

function fail(error: MintError, palette: Palette): number {
  write(process.stderr, `${palette.red('mint:')} ${error.message}\n`);
  if (error.hint) write(process.stderr, `${palette.dim(`  ${error.hint}`)}\n`);
  return error.exitCode;
}

function unknownCommand(command: string): UsageError {
  const guess = suggest(command, GENERATORS.map((generator) => generator.name));
  return new UsageError(
    `unknown command "${command}"`,
    guess ? `did you mean "mint ${guess}"?` : 'run "mint --help" to list every generator',
  );
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
    try {
      const size = parseSize(command, 'the shorthand size');
      return { generator: findGenerator('bytes')!, args: positionals, shorthandSize: size };
    } catch {
      throw new UsageError(
        `"${command}" does not look like a size`,
        `try mint 32, mint 128 or "mint dice ${command}"`,
      );
    }
  }
  throw unknownCommand(command);
}

function main(argv: readonly string[]): number {
  const stdoutPalette = paletteFor(process.stdout);
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
    const generator = findGenerator(target);
    if (!generator) throw unknownCommand(target);
    write(process.stdout, renderCommandHelp(generator, stdoutPalette, target));
    return 0;
  }

  if (parsed.command === null) {
    write(process.stdout, renderMainHelp(stdoutPalette));
    return 0;
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
