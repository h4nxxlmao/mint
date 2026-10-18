import { UsageError } from './errors.js';

export type FlagType = 'boolean' | 'int' | 'size' | 'string' | 'enum';

export interface FlagSpec {
  /** Canonical key, e.g. `newline` for `--no-newline`. */
  name: string;
  type: FlagType;
  /** How the flag is rendered in help output. Defaults to `--name`. */
  shownAs?: string;
  /** Single character alias, e.g. `l` for `--length`. */
  alias?: string;
  /** Value forced when the alias is used (e.g. `-n` implies `newline: false`). */
  aliasValue?: string | boolean;
  /** Placeholder shown in help, e.g. `<n>`. */
  arg?: string;
  description: string;
  /** Allowed values for `enum` flags. */
  values?: readonly string[];
  /** Default shown in help. */
  default?: string | number | boolean;
  hidden?: boolean;
}

export const SIZE_SUFFIXES: Record<string, number> = {
  k: 1024,
  kb: 1024,
  m: 1024 * 1024,
  mb: 1024 * 1024,
};

/** Parse `16`, `32`, `1k`, `2kb`, `1m` into a number. */
export function parseSize(raw: string, label: string): number {
  const match = /^(\d+)([a-z]*)$/iu.exec(raw.trim());
  if (!match) {
    throw new UsageError(`${label} expects a positive integer, got "${raw}"`, 'try 16, 32, 1k or 1m');
  }
  const [, digits, suffix] = match;
  const base = Number(digits);
  const multiplier = suffix === '' ? 1 : SIZE_SUFFIXES[suffix.toLowerCase()];
  if (multiplier === undefined) {
    throw new UsageError(`${label} has an unknown size suffix "${suffix}"`, 'supported suffixes: k, kb, m, mb');
  }
  const value = base * multiplier;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new UsageError(`${label} must be at least 1, got "${raw}"`);
  }
  return value;
}

function levenshtein(a: string, b: string): number {
  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) previous[j] = current[j];
  }
  return previous[b.length];
}

export function suggest(input: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const score = levenshtein(input.toLowerCase(), candidate.toLowerCase());
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  const threshold = input.length <= 4 ? 2 : 3;
  return bestScore <= threshold ? best : undefined;
}

/** Typed, validated accessor over parsed flag values. */
export class Flags {
  private readonly values: Map<string, string | boolean>;

  constructor(values: Map<string, string | boolean> = new Map()) {
    this.values = values;
  }

  set(name: string, value: string | boolean): void {
    this.values.set(name, value);
  }

  has(name: string): boolean {
    return this.values.has(name);
  }

  getBool(name: string, fallback = false): boolean {
    const value = this.values.get(name);
    if (value === undefined) return fallback;
    return value === true || value === 'true';
  }

  getString(name: string): string | undefined {
    const value = this.values.get(name);
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value ? '' : undefined;
    return value;
  }

  getInt(name: string, options: { min?: number; max?: number; label?: string } = {}): number | undefined {
    const raw = this.getString(name);
    if (raw === undefined) return undefined;
    const label = options.label ?? `--${name}`;
    if (!/^-?\d+$/u.test(raw.trim())) {
      throw new UsageError(`${label} expects an integer, got "${raw}"`);
    }
    const value = Number(raw);
    if (options.min !== undefined && value < options.min) {
      throw new UsageError(`${label} must be at least ${options.min}, got ${value}`);
    }
    if (options.max !== undefined && value > options.max) {
      throw new UsageError(`${label} must be at most ${options.max}, got ${value}`);
    }
    return value;
  }

  getSize(name: string, options: { min?: number; max?: number } = {}): number | undefined {
    const raw = this.getString(name);
    if (raw === undefined) return undefined;
    const value = parseSize(raw, `--${name}`);
    if (options.min !== undefined && value < options.min) {
      throw new UsageError(`--${name} must be at least ${options.min}, got ${value}`);
    }
    if (options.max !== undefined && value > options.max) {
      throw new UsageError(`--${name} max is ${options.max}, got ${value}`);
    }
    return value;
  }

  getEnum<T extends string>(name: string, allowed: readonly T[]): T | undefined {
    const raw = this.getString(name);
    if (raw === undefined) return undefined;
    const normalized = raw.toLowerCase();
    if (!allowed.includes(normalized as T)) {
      throw new UsageError(
        `--${name} must be one of: ${allowed.join(', ')} (got "${raw}")`,
        suggest(normalized, allowed) ? `did you mean --${name} ${suggest(normalized, allowed)}?` : undefined,
      );
    }
    return normalized as T;
  }

  keys(): string[] {
    return [...this.values.keys()];
  }
}
