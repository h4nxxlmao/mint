import { UsageError } from './errors.js';
import { GLOBAL_FLAG_NAMES } from './specs.js';
import type { Flags } from './flags.js';
import type { GenResult, Generator } from './types.js';

/** Reject flags that the generator does not declare, with a list of what it does support. */
export function assertSupportedFlags(generator: Generator, given: readonly string[]): void {
  const allowed = new Set<string>([...GLOBAL_FLAG_NAMES, ...(generator.flags ?? [])]);
  const rejected = given.filter((name) => !allowed.has(name));
  if (rejected.length === 0) return;

  const label = rejected.map((name) => `--${name}`).join(', ');
  const supported = (generator.flags ?? []).map((name) => `--${name}`).join(', ');
  throw new UsageError(
    `${label} is not supported by "mint ${generator.name}"`,
    supported.length > 0 ? `supported flags: ${supported}` : `"mint ${generator.name}" takes no extra flags`,
  );
}

/** Validate the invocation, then run the generator (possibly several times for --count). */
export function dispatch(generator: Generator, flags: Flags, positionals: string[]): GenResult[] {
  assertSupportedFlags(generator, flags.keys());

  if (positionals.length > 0 && !generator.acceptsPositionals) {
    throw new UsageError(
      `"mint ${generator.name}" does not take arguments (got "${positionals.join(' ')}")`,
      generator.examples?.[0] ? `example: ${generator.examples[0]}` : undefined,
    );
  }

  const count = flags.getInt('count', { min: 1, max: 10_000 }) ?? 1;
  const context = { command: generator.name, flags, positionals };
  const iterations = generator.usesCount ? 1 : count;
  const results: GenResult[] = [];
  for (let index = 0; index < iterations; index++) {
    results.push(generator.run(context));
  }
  return results;
}
