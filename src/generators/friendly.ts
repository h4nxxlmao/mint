import { createHash } from 'node:crypto';
import { CROCKFORD_ALPHABET, encodeCrockford } from '../encodings.js';
import { alphabetEntropyBits, randomIntBelow, sampleChars, sampleOne } from '../random.js';
import { WORDLIST } from '../wordlist.js';
import type { Generator } from '../types.js';

/**
 * Human-facing random values: a memorable slug and a typeable license key.
 */

export const aliasGenerator: Generator = {
  name: 'alias',
  summary: 'Memorable slug such as brave-otter-42',
  usage: 'alias [--words 2] [--no-number] [--separator -]',
  details: [
    'Words come from the bundled 2048-word list and the tail is a 0-99 number.',
    'For names, project slugs and usernames - use `mint passphrase` when you need a password.',
  ],
  examples: ['mint alias', 'mint alias --words 3', 'mint alias --no-number', 'mint alias --count 5'],
  flags: ['words', 'number', 'separator'],
  run(context) {
    const flags = context.flags;
    const words = flags.getInt('words', { min: 1, max: 4 }) ?? 2;
    const separator = flags.getString('separator') ?? '-';

    const parts: string[] = [];
    for (let index = 0; index < words; index++) parts.push(sampleOne(WORDLIST));

    const withNumber = flags.getBool('number', true);
    const number = withNumber ? randomIntBelow(100) : undefined;
    const tail = number === undefined ? '' : `${separator}${String(number).padStart(2, '0')}`;
    return {
      value: `${parts.join(separator)}${tail}`,
      fields: { words, number: number ?? '' },
      entropyBits: alphabetEntropyBits(words, WORDLIST.length) + (withNumber ? Math.log2(100) : 0),
    };
  },
};

export const licenseGenerator: Generator = {
  name: 'license',
  summary: 'Grouped license key in Crockford base32, with a typo-catching checksum',
  usage: 'license [--groups 4] [--group-size 5] [--no-checksum]',
  details: [
    'Crockford base32 leaves out I, L, O and U, so keys survive being read aloud or retyped.',
    '--checksum (on by default) appends one more group derived from the rest of the key;',
    'it catches typos before a support ticket does. --no-checksum turns it off.',
  ],
  examples: ['mint license', 'mint license --groups 5', 'mint license --group-size 4 --no-checksum'],
  flags: ['groups', 'group-size', 'checksum', 'separator'],
  run(context) {
    const flags = context.flags;
    const groups = flags.getInt('groups', { min: 1, max: 10 }) ?? 4;
    const groupSize = flags.getInt('group-size', { min: 3, max: 12 }) ?? 5;
    const separator = flags.getString('separator') ?? '-';

    const parts: string[] = [];
    for (let index = 0; index < groups; index++) parts.push(sampleChars(groupSize, CROCKFORD_ALPHABET));
    let value = parts.join(separator);
    let checksum: string | undefined;

    if (flags.getBool('checksum', true)) {
      checksum = encodeCrockford(createHash('sha256').update(value).digest()).slice(0, groupSize);
      value += `${separator}${checksum}`;
    }

    return {
      value,
      fields: { groups, groupSize, ...(checksum === undefined ? {} : { checksum }) },
      entropyBits: alphabetEntropyBits(groups * groupSize, CROCKFORD_ALPHABET.length),
    };
  },
};
