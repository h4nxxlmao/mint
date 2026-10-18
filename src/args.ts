import { UsageError } from './errors.js';
import { Flags, type FlagSpec, suggest } from './flags.js';

export interface ParsedArgs {
  command: string | null;
  flags: Flags;
  positionals: string[];
}

/**
 * Hand-rolled argv parser.
 *
 * Supports `--flag`, `--flag value`, `--flag=value`, `--no-flag`, `-x`, `-x value`,
 * `-xvalue`, `-x=value`, and `--` to stop flag parsing. Like GNU getopt, a flag
 * that expects a value always consumes the next token, so `--suffix -y` works.
 */
export function parseArgs(argv: readonly string[], specs: Map<string, FlagSpec>, aliases: Map<string, string>): ParsedArgs {
  const flags = new Flags();
  const positionals: string[] = [];
  let command: string | null = null;
  let onlyPositionals = false;

  const applyFlag = (spec: FlagSpec, raw: string | undefined, usedName: string): void => {
    if (spec.type === 'boolean') {
      flags.set(spec.name, true);
      return;
    }
    if (raw === undefined) {
      throw new UsageError(`flag ${usedName} requires a value`, `usage: ${usedName}${spec.arg ?? ' <value>'}`);
    }
    flags.set(spec.name, raw);
  };

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];

    if (onlyPositionals) {
      positionals.push(token);
      continue;
    }
    if (token === '--') {
      onlyPositionals = true;
      continue;
    }
    if (token.startsWith('--')) {
      const body = token.slice(2);
      const eq = body.indexOf('=');
      const name = eq === -1 ? body : body.slice(0, eq);
      const inlineValue = eq === -1 ? undefined : body.slice(eq + 1);
      const negated = name.startsWith('no-') && specs.has(name.slice(3)) && specs.get(name.slice(3))!.type === 'boolean';
      const lookup = negated ? name.slice(3) : name;
      const spec = specs.get(lookup);
      if (!spec) {
        const hint = suggest(lookup, specs.keys());
        throw new UsageError(`unknown flag --${name}`, hint ? `did you mean --${hint}?` : 'run "mint --help" to see all flags');
      }
      if (negated) {
        if (inlineValue !== undefined) throw new UsageError(`flag --${name} does not take a value`);
        flags.set(spec.name, false);
        continue;
      }
      if (spec.type === 'boolean') {
        if (inlineValue !== undefined) throw new UsageError(`flag --${name} does not take a value`);
        applyFlag(spec, undefined, `--${name}`);
        continue;
      }
      if (inlineValue !== undefined) {
        applyFlag(spec, inlineValue, `--${name}`);
        continue;
      }
      const next = argv[index + 1];
      if (next === undefined) {
        throw new UsageError(`flag --${name} requires a value`, `usage: --${name}${spec.arg ?? ' <value>'}`);
      }
      index++;
      applyFlag(spec, next, `--${name}`);
      continue;
    }
    if (token.startsWith('-') && token.length > 1) {
      const body = token.slice(1);
      const eq = body.indexOf('=');
      const shortName = body[0];
      const canonical = aliases.get(shortName);
      if (canonical === undefined) {
        throw new UsageError(`unknown flag -${shortName}`, 'run "mint --help" to see all flags');
      }
      const spec = specs.get(canonical)!;
      if (spec.type === 'boolean') {
        if (eq !== -1) throw new UsageError(`flag -${shortName} does not take a value`);
        flags.set(spec.name, spec.aliasValue ?? true);
        continue;
      }
      if (eq !== -1) {
        applyFlag(spec, body.slice(eq + 1), `-${shortName}`);
        continue;
      }
      if (body.length > 1) {
        applyFlag(spec, body.slice(1), `-${shortName}`);
        continue;
      }
      const next = argv[index + 1];
      if (next === undefined) {
        throw new UsageError(`flag -${shortName} requires a value`, `usage: -${shortName}${spec.arg ?? ' <value>'}`);
      }
      index++;
      applyFlag(spec, next, `-${shortName}`);
      continue;
    }

    if (command === null) command = token;
    else positionals.push(token);
  }

  return { command, flags, positionals };
}

export function buildAliasMap(specs: Map<string, FlagSpec>): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const spec of specs.values()) {
    if (spec.alias) {
      if (aliases.has(spec.alias)) throw new Error(`duplicate flag alias: -${spec.alias}`);
      aliases.set(spec.alias, spec.name);
    }
  }
  return aliases;
}
