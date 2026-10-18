/**
 * Programmatic access to mint's generators.
 *
 * The CLI is the main product; this module exists so the same generators can be
 * called from Node without shelling out. Everything is still powered by
 * `node:crypto`, with no runtime dependencies.
 */
import { Flags } from './flags.js';
import { buildSpecMap } from './specs.js';
import { findGenerator } from './registry.js';
import { dispatch } from './dispatch.js';
import { UsageError } from './errors.js';
import type { GenResult } from './types.js';

export { VERSION, REPO_URL } from './version.js';
export { GENERATORS, CATEGORIES, findGenerator } from './registry.js';
export { MintError, UsageError, RuntimeError } from './errors.js';
export { assertSupportedFlags, dispatch } from './dispatch.js';
export {
  randomBytes,
  randomIntBelow,
  randomBigIntBelow,
  randomInRange,
  randomBigIntInRange,
  sampleChar,
  sampleChars,
  sampleOne,
  sampleMany,
  shuffle,
  alphabetEntropyBits,
} from './random.js';
export {
  encodeBase32,
  encodeBase58,
  encodeBase62,
  encodeBase64,
  encodeCrockford,
  encodeHex,
  encodePowerOfTwo,
} from './encodings.js';
export { WORDLIST, WORDLIST_SIZE } from './wordlist.js';
export type { GenResult, GenContext, Generator } from './types.js';

const SPECS = buildSpecMap();

/** Flag values accepted by {@link mint}: `--length 32` becomes `{ length: 32 }`. */
export type MintOptions = Record<string, string | number | boolean>;

/**
 * Generate one value.
 *
 * ```js
 * import { mint } from '@npm-install-hanx/mint';
 * mint('uuid');                                  // v4 uuid
 * mint('hex', { bytes: 32 });                    // 64 hex characters
 * mint('pick', {}, ['red', 'green', 'blue']);    // random choice
 * ```
 */
export function mint(command: string, options: MintOptions = {}, positionals: string[] = []): GenResult {
  const generator = findGenerator(command);
  if (!generator) throw new UsageError(`unknown generator "${command}"`);

  const flags = new Flags();
  for (const [key, value] of Object.entries(options)) {
    const name = key.replace(/^--/u, '');
    if (!SPECS.has(name)) throw new UsageError(`unknown flag --${name}`);
    flags.set(name, typeof value === 'boolean' ? value : String(value));
  }

  return dispatch(generator, flags, positionals)[0];
}

/** Convenience wrapper returning just the value string. */
export function mintValue(command: string, options: MintOptions = {}, positionals: string[] = []): string {
  return mint(command, options, positionals).value;
}
