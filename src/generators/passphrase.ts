import { UsageError } from '../errors.js';
import { randomIntBelow, sampleOne } from '../random.js';
import { WORDLIST } from '../wordlist.js';
import { readSize } from '../size.js';
import { requestedBits } from './chars.js';
import type { GenResult, Generator } from '../types.js';

const BITS_PER_WORD = Math.log2(WORDLIST.length); // 11 bits for 2048 words

export const passphraseGenerator: Generator = {
  name: 'passphrase',
  summary: 'Diceware-style passphrase from a 2048-word list',
  usage: 'passphrase [--words 6] [--separator -] [--capitalize] [--number]',
  details: [
    `Each word is drawn uniformly from a bundled ${WORDLIST.length}-word list (${BITS_PER_WORD} bits per word),`,
    'so a 6-word passphrase carries 66 bits of entropy.',
    '--bytes/--bits pick the shortest word count that reaches the entropy target.',
  ],
  examples: ['mint passphrase', 'mint passphrase --words 8 --separator .', 'mint passphrase --words 5 --capitalize --number'],
  flags: ['words', 'separator', 'capitalize', 'number', 'bytes', 'bits'],
  run(context): GenResult {
    const flags = context.flags;
    const request = readSize(flags);
    const explicitWords = flags.getInt('words', { min: 1, max: 128 });
    const wanted = requestedBits(request);
    if (explicitWords !== undefined && wanted !== undefined) {
      throw new UsageError('use either --words or --bytes/--bits, not both');
    }

    const wordCount = explicitWords ?? (wanted !== undefined ? Math.ceil(wanted / BITS_PER_WORD) : 6);
    const separator = flags.getString('separator') ?? '-';

    const words: string[] = [];
    for (let index = 0; index < wordCount; index++) {
      const word = sampleOne(WORDLIST);
      words.push(flags.getBool('capitalize') ? word[0].toUpperCase() + word.slice(1) : word);
    }

    const withNumber = flags.getBool('number');
    const number = withNumber ? randomIntBelow(100) : undefined;
    const value = withNumber ? words.join(separator) + separator + String(number) : words.join(separator);

    return {
      value,
      fields: { words: wordCount, separator, number: number ?? '' },
      entropyBits: wordCount * BITS_PER_WORD + (withNumber ? Math.log2(100) : 0),
    };
  },
};
