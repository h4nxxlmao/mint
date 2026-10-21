import { createHash } from 'node:crypto';
import { UsageError } from '../errors.js';
import { randomBytes } from '../random.js';
import { WORDLIST } from '../wordlist.js';
import type { Generator } from '../types.js';

/**
 * BIP-39 recovery phrases: 128-256 bits of entropy plus a SHA-256 checksum, encoded
 * as 11-bit indices into the bundled 2048-word list. mint does not derive keys from
 * the phrase - it only generates the mnemonic.
 */

export const WORD_COUNTS = [12, 15, 18, 21, 24] as const;

function bitsOf(bytes: Buffer): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(2).padStart(8, '0');
  return out;
}

export function entropyToMnemonic(entropy: Buffer, separator = ' '): string {
  const entropyBits = entropy.length * 8;
  if (entropyBits < 128 || entropyBits > 256 || entropyBits % 32 !== 0) {
    throw new UsageError(`mnemonic entropy must be 128, 160, 192, 224 or 256 bits, got ${String(entropyBits)}`);
  }
  const checksumLength = entropyBits / 32;
  const checksum = bitsOf(createHash('sha256').update(entropy).digest()).slice(0, checksumLength);
  const bits = bitsOf(entropy) + checksum;

  const words: string[] = [];
  for (let index = 0; index < bits.length; index += 11) {
    const wordIndex = Number.parseInt(bits.slice(index, index + 11), 2);
    const word = WORDLIST[wordIndex];
    if (word === undefined) throw new UsageError(`word index ${String(wordIndex)} is outside the word list`);
    words.push(word);
  }
  return words.join(separator);
}

/** Inverse of {@link entropyToMnemonic}; also validates the checksum. */
export function mnemonicToEntropy(mnemonic: string): Buffer {
  const words = mnemonic.trim().toLowerCase().split(/[\s,]+/u).filter((word) => word !== '');
  if (!(WORD_COUNTS as readonly number[]).includes(words.length)) {
    throw new UsageError(`a mnemonic has 12, 15, 18, 21 or 24 words, got ${String(words.length)}`);
  }
  let bits = '';
  for (const word of words) {
    const index = WORDLIST.indexOf(word);
    if (index === -1) throw new UsageError(`"${word}" is not in the word list`);
    bits += index.toString(2).padStart(11, '0');
  }
  const entropyBits = (words.length * 11 * 32) / 33;
  const checksumLength = entropyBits / 32;
  const entropy = Buffer.alloc(entropyBits / 8);
  for (let index = 0; index < entropy.length; index++) {
    entropy[index] = Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2);
  }
  const expected = bitsOf(createHash('sha256').update(entropy).digest()).slice(0, checksumLength);
  const actual = bits.slice(entropyBits);
  if (expected !== actual) throw new UsageError('mnemonic checksum does not match');
  return entropy;
}

export const mnemonicGenerator: Generator = {
  name: 'mnemonic',
  summary: 'BIP-39 recovery phrase (12, 15, 18, 21 or 24 words)',
  usage: 'mnemonic [--words 12] [--separator " "]',
  details: [
    'Each phrase carries 128 to 256 bits of CSPRNG entropy plus a SHA-256 checksum.',
    '12 words = 128 bits, 24 words = 256 bits. --bytes/--bits round up to the next',
    'valid phrase length.',
    'The words come from the BIP-39 English list. mint generates the phrase only: it',
    'does not derive keys, and it never writes the phrase anywhere.',
  ],
  examples: ['mint mnemonic', 'mint mnemonic --words 24', 'mint mnemonic --separator "-"'],
  flags: ['words', 'separator', 'bytes', 'bits'],
  run(context) {
    const flags = context.flags;
    const wordsFlag = flags.getInt('words', { min: 12, max: 24 });
    if (wordsFlag !== undefined && !(WORD_COUNTS as readonly number[]).includes(wordsFlag)) {
      throw new UsageError(`--words must be one of ${WORD_COUNTS.join(', ')}, got ${String(wordsFlag)}`);
    }
    if (wordsFlag !== undefined && (flags.has('bytes') || flags.has('bits'))) {
      throw new UsageError('use either --words or --bytes/--bits, not both');
    }

    let words: number;
    if (wordsFlag !== undefined) {
      words = wordsFlag;
    } else {
      const requestedBytes = flags.getSize('bytes');
      const requestedBits = flags.getSize('bits');
      const wanted = requestedBytes !== undefined ? requestedBytes * 8 : requestedBits;
      if (wanted === undefined) {
        words = 12;
      } else {
        const size = WORD_COUNTS.find((count) => (count * 11 * 32) / 33 >= wanted);
        if (size === undefined) {
          throw new UsageError(`--bytes/--bits too large: at most 256 bits fit in 24 words (got ${String(wanted)} bits)`);
        }
        words = size;
      }
    }

    const entropyBits = (words * 11 * 32) / 33;
    const entropy = randomBytes(entropyBits / 8);
    const separator = flags.getString('separator') ?? ' ';
    const value = entropyToMnemonic(entropy, separator);

    return {
      value,
      fields: { words, entropyBits },
      entropyBits,
    };
  },
};
