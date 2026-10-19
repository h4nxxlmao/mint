import type { Palette } from '../colors.js';
import { UsageError } from '../errors.js';
import { suggest } from '../flags.js';
import type { Flags } from '../flags.js';
import { GUARD_COMMANDS } from './commands.js';
import { renderGuardCommandHelp, renderGuardHelp } from './help.js';
import type { GuardCommand, GuardContext, GuardResult } from './types.js';

/** Flags every guard subcommand accepts. */
const GUARD_GLOBAL_FLAGS: readonly string[] = ['help', 'version', 'color', 'json', 'quiet'];

export interface GuardIo {
  cwd: string;
  palette: Palette;
  /** Progress text; the CLI sends it to stderr only when it is a TTY. */
  progress(message: string): void;
}

function allowedFlags(command: GuardCommand): Set<string> {
  return new Set([...GUARD_GLOBAL_FLAGS, ...command.flags]);
}

function assertAllowed(given: readonly string[], allowed: Set<string>, label: string): void {
  const rejected = given.filter((name) => !allowed.has(name));
  if (rejected.length === 0) return;
  const label2 = rejected.map((name) => `--${name}`).join(', ');
  const supported = [...allowed]
    .filter((name) => name !== 'help' && name !== 'version')
    .map((name) => `--${name}`)
    .join(', ');
  throw new UsageError(
    `${label2} is not supported by ${label}`,
    supported.length > 0 ? `supported flags: ${supported}` : `${label} takes no flags`,
  );
}

function commandHelp(query: string, io: GuardIo): GuardResult {
  const command = GUARD_COMMANDS.find((item) => item.name === query);
  if (!command) {
    const guess = suggest(query, GUARD_COMMANDS.map((item) => item.name));
    throw new UsageError(
      `unknown guard command "${query}"`,
      guess ? `did you mean "mint guard ${guess}"?` : 'run "mint guard --help" to list every command',
    );
  }
  return { code: 0, stdout: renderGuardCommandHelp(command, io.palette), stderr: '' };
}

/**
 * Entry point for `mint guard ...`. Positionals are everything after `guard`, so a
 * subcommand sees its own arguments at index 0.
 *
 * Returns a promise for the git-history scan, which streams `git log` instead of
 * buffering it.
 */
export function runGuard(
  positionals: readonly string[],
  flags: Flags,
  io: GuardIo,
): GuardResult | Promise<GuardResult> {
  const [subcommand, ...rest] = positionals;
  const wantsHelp = flags.getBool('help');

  if (subcommand === undefined) {
    return { code: 0, stdout: renderGuardHelp(GUARD_COMMANDS, io.palette), stderr: '' };
  }
  if (subcommand === 'help') {
    if (rest[0] === undefined) {
      return { code: 0, stdout: renderGuardHelp(GUARD_COMMANDS, io.palette), stderr: '' };
    }
    return commandHelp(rest[0], io);
  }

  const command = GUARD_COMMANDS.find((item) => item.name === subcommand);
  if (!command) {
    const guess = suggest(subcommand, GUARD_COMMANDS.map((item) => item.name));
    throw new UsageError(
      `unknown guard command "${subcommand}"`,
      guess ? `did you mean "mint guard ${guess}"?` : 'run "mint guard --help" to list every command',
    );
  }

  if (wantsHelp) return { code: 0, stdout: renderGuardCommandHelp(command, io.palette), stderr: '' };

  assertAllowed(flags.keys(), allowedFlags(command), `"mint guard ${command.name}"`);

  const context: GuardContext = {
    root: io.cwd,
    cwd: io.cwd,
    flags,
    positionals: rest,
    palette: io.palette,
    progress: (message: string) => {
      io.progress(message);
    },
  };
  return command.run(context);
}

export { GUARD_COMMANDS } from './commands.js';
export type { GuardCommand, GuardContext, GuardResult, GuardReport, Finding, Severity } from './types.js';
export { RULES, PROVIDERS } from './rules.js';
export { previewSecret } from './redact.js';
