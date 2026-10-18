import { UsageError } from './errors.js';
import type { FlagSpec, Flags } from './flags.js';

const spec = (value: FlagSpec): FlagSpec => value;

export const GLOBAL_FLAGS: readonly FlagSpec[] = [
  spec({ name: 'help', type: 'boolean', alias: 'h', description: 'Show help' }),
  spec({ name: 'version', type: 'boolean', alias: 'v', description: 'Print the mint version' }),
  spec({
    name: 'count',
    type: 'int',
    alias: 'c',
    arg: '<n>',
    description: 'Generate n values',
    default: 1,
  }),
  spec({ name: 'json', type: 'boolean', description: 'Emit JSON with value + metadata' }),
  spec({
    name: 'newline',
    type: 'boolean',
    alias: 'n',
    aliasValue: false,
    shownAs: '--no-newline',
    description: 'Do not print a trailing newline',
    default: true,
  }),
  spec({ name: 'copy', type: 'boolean', description: 'Copy the result to the clipboard' }),
  spec({ name: 'entropy', type: 'boolean', description: 'Print bits of entropy to stderr' }),
  spec({
    name: 'env',
    type: 'string',
    arg: '<NAME>',
    description: 'Print as NAME=value (NAME_1..NAME_n with --count)',
  }),
  spec({ name: 'prefix', type: 'string', arg: '<str>', description: 'Prepend a literal string' }),
  spec({ name: 'suffix', type: 'string', arg: '<str>', description: 'Append a literal string' }),
  spec({
    name: 'color',
    type: 'boolean',
    shownAs: '--no-color',
    description: 'Disable colors (also honors NO_COLOR)',
    default: true,
  }),
];

export const SIZE_FLAGS: readonly FlagSpec[] = [
  spec({
    name: 'length',
    type: 'size',
    alias: 'l',
    arg: '<n>',
    description: 'Output length in characters (k/m suffixes allowed)',
  }),
  spec({ name: 'size', type: 'size', arg: '<n>', description: 'Alias for --length' }),
  spec({ name: 'bytes', type: 'size', alias: 'b', arg: '<n>', description: 'Bytes of entropy to draw' }),
  spec({ name: 'bits', type: 'size', arg: '<n>', description: 'Bits of entropy to draw' }),
];

export const EXTRA_FLAGS: readonly FlagSpec[] = [
  // encodings
  spec({ name: 'hex', type: 'boolean', description: 'Hex output' }),
  spec({ name: 'base64', type: 'boolean', description: 'Base64 output' }),
  spec({ name: 'base64url', type: 'boolean', description: 'URL-safe base64 output' }),
  spec({ name: 'base32', type: 'boolean', description: 'RFC 4648 base32 output' }),
  spec({ name: 'base58', type: 'boolean', description: 'Base58 output' }),
  spec({ name: 'crockford', type: 'boolean', description: 'Crockford base32 output' }),
  spec({ name: 'binary', type: 'boolean', description: 'Binary 0/1 output' }),
  spec({ name: 'format', type: 'string', arg: '<name>', description: 'Output format (see command help)' }),
  spec({ name: 'upper', type: 'boolean', description: 'Uppercase output' }),
  spec({ name: 'lower', type: 'boolean', description: 'Lowercase output' }),
  spec({ name: 'padding', type: 'boolean', shownAs: '--no-padding', description: 'Strip/keep base32 padding', default: true }),

  // character sets
  spec({
    name: 'charset',
    type: 'string',
    arg: '<preset|list>',
    description: 'Preset (alnum, alpha, lower, upper, digits, hex, symbols, safe, url-safe) or literal characters',
    default: 'alnum',
  }),
  spec({ name: 'exclude', type: 'string', arg: '<chars>', description: 'Remove these characters from the charset' }),
  spec({ name: 'require-each', type: 'boolean', description: 'Include at least one character of every class' }),
  spec({ name: 'digits', type: 'boolean', shownAs: '--no-digits', description: 'Allow digits', default: true }),
  spec({ name: 'symbols', type: 'boolean', shownAs: '--no-symbols', description: 'Allow symbols', default: true }),
  spec({ name: 'ambiguous', type: 'boolean', shownAs: '--no-ambiguous', description: 'Allow look-alike characters (0, O, o, 1, l, I, i)', default: true }),

  // passphrase
  spec({ name: 'words', type: 'int', arg: '<n>', description: 'Number of words', default: 6 }),
  spec({ name: 'separator', type: 'string', arg: '<str>', description: 'Word separator', default: '-' }),
  spec({ name: 'capitalize', type: 'boolean', description: 'Capitalize each word' }),
  spec({ name: 'number', type: 'boolean', description: 'Append a random 0-99 number' }),
  spec({
    name: 'leading-zero',
    type: 'boolean',
    shownAs: '--no-leading-zero',
    description: 'Allow a leading zero',
    default: true,
  }),

  // identifiers
  spec({ name: 'dashes', type: 'boolean', shownAs: '--no-dashes', description: 'Include dashes', default: true }),
  spec({ name: 'v4', type: 'boolean', description: 'UUID v4 (random)' }),
  spec({ name: 'v7', type: 'boolean', description: 'UUID v7 (time-sortable)' }),
  spec({ name: 'v1', type: 'boolean', description: 'UUID v1 (timestamp + random node)' }),
  spec({ name: 'nil', type: 'boolean', description: 'All-zero UUID' }),
  spec({ name: 'alphabet', type: 'string', arg: '<chars>', description: 'Custom alphabet' }),
  spec({ name: 'sortable', type: 'boolean', description: 'Prefix with a base36 timestamp' }),
  spec({ name: 'worker', type: 'int', arg: '<0-1023>', description: 'Snowflake worker id' }),
  spec({ name: 'type', type: 'string', arg: '<name>', description: 'TypeID type prefix', default: 'id' }),

  // developer secrets
  spec({ name: 'algo', type: 'string', arg: '<name>', description: 'Algorithm (sha256, sha384, sha512)' }),
  spec({ name: 'iv', type: 'boolean', description: 'Also generate an IV' }),
  spec({ name: 'checksum', type: 'boolean', description: 'Append a short validation checksum' }),

  // misc
  spec({ name: 'min', type: 'int', arg: '<n>', description: 'Minimum value (inclusive)' }),
  spec({ name: 'max', type: 'int', arg: '<n>', description: 'Maximum value (inclusive)' }),
  spec({ name: 'public', type: 'boolean', description: 'Exclude private/reserved addresses' }),
  spec({ name: 'compressed', type: 'boolean', description: 'Use RFC 5952 :: compression' }),
  spec({ name: 'unique', type: 'boolean', description: 'Pick distinct items' }),
];

export const ALL_FLAGS: readonly FlagSpec[] = [...GLOBAL_FLAGS, ...SIZE_FLAGS, ...EXTRA_FLAGS];

export const GLOBAL_FLAG_NAMES: readonly string[] = GLOBAL_FLAGS.map((item) => item.name);

export function buildSpecMap(): Map<string, FlagSpec> {
  const map = new Map<string, FlagSpec>();
  for (const item of ALL_FLAGS) {
    if (map.has(item.name)) throw new Error(`duplicate flag definition: --${item.name}`);
    map.set(item.name, item);
  }
  return map;
}

export function specFor(name: string): FlagSpec | undefined {
  return ALL_FLAGS.find((item) => item.name === name);
}

/** Validate that every flag a generator declares actually exists. */
export function assertKnownFlags(owner: string, names: readonly string[]): void {
  for (const name of names) {
    if (!specFor(name)) throw new Error(`${owner} declares unknown flag --${name}`);
  }
}

/** Reject `--a --b` style flag combinations where only one is meaningful. */
export function assertExclusive(flags: Flags, names: readonly string[], label: string): string | undefined {
  const used = names.filter((name) => flags.has(name));
  if (used.length > 1) {
    throw new UsageError(
      `${label}: use only one of ${used.map((name) => `--${name}`).join(', ')}`,
    );
  }
  return used[0];
}
