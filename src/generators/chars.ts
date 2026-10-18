import { UsageError } from '../errors.js';
import { alphabetEntropyBits, sampleChars, sampleOne, shuffle } from '../random.js';
import { charsForEntropy, readSize, type SizeRequest } from '../size.js';
import { AMBIGUOUS, ALNUM, DIGITS, SYMBOLS, classesOf, resolveCharset } from '../charsets.js';
import type { GenContext, GenResult, Generator } from '../types.js';

const CHARSET_FLAGS = [
  'charset',
  'exclude',
  'require-each',
  'ambiguous',
  'length',
  'size',
  'bytes',
  'bits',
  'upper',
  'lower',
] as const;

/** Bits of entropy the user asked for, or undefined when they asked for a character count. */
export function requestedBits(request: SizeRequest): number | undefined {
  if (request.mode === 'bytes') return request.bytes! * 8;
  if (request.mode === 'bits') return request.bits!;
  return undefined;
}

/** Character count needed to reach at least `bits` of entropy with a charset of the given size. */
function lengthForBits(request: SizeRequest, alphabetSize: number, fallbackLength: number): number {
  const wanted = requestedBits(request);
  if (wanted !== undefined) return charsForEntropy(wanted, alphabetSize);
  return request.chars ?? fallbackLength;
}

/**
 * Guarantee at least one character of every class present in the charset.
 *
 * Characters are replaced at random positions that are never the last
 * representative of another class, then the whole string is shuffled so the
 * forced characters cannot be spotted by position.
 */
export function enforceEachClass(chars: string[], charset: string): void {
  const classes = classesOf(charset);
  if (classes.length < 2) return;
  if (chars.length < classes.length) {
    throw new UsageError(`--require-each needs a length of at least ${classes.length} for this charset`);
  }

  const owner = chars.map((char) => classes.findIndex((group) => group.includes(char)));
  const remaining = new Map<number, number>();
  for (const classIndex of owner) remaining.set(classIndex, (remaining.get(classIndex) ?? 0) + 1);

  const missing = classes.map((_, index) => index).filter((index) => !remaining.has(index));
  if (missing.length === 0) return;

  const order = shuffle([...chars.keys()]);
  const claimed = new Set<number>();
  for (const classIndex of missing) {
    const position = order.find(
      (index) => !claimed.has(index) && (remaining.get(owner[index]) ?? 0) > 1,
    );
    if (position === undefined) {
      throw new UsageError(`cannot fit one character of every class into ${chars.length} characters`);
    }
    claimed.add(position);
    const previous = owner[position];
    remaining.set(previous, (remaining.get(previous) ?? 1) - 1);
    owner[position] = classIndex;
    remaining.set(classIndex, (remaining.get(classIndex) ?? 0) + 1);
    chars[position] = sampleOne(classes[classIndex]);
  }

  const shuffled = shuffle(chars);
  for (let index = 0; index < chars.length; index++) chars[index] = shuffled[index];
}

function applyCase(context: GenContext, text: string): string {
  const upper = context.flags.getBool('upper');
  const lower = context.flags.getBool('lower');
  if (upper && lower) throw new UsageError('use only one of --upper and --lower');
  if (upper) return text.toUpperCase();
  if (lower) return text.toLowerCase();
  return text;
}

function charsRun(context: GenContext): GenResult {
  const flags = context.flags;
  const charset = resolveCharset(flags.getString('charset'), {
    exclude: flags.getString('exclude'),
    excludeAmbiguous: !flags.getBool('ambiguous', true),
    fallback: ALNUM,
  });
  const request = readSize(flags);
  const length = lengthForBits(request, charset.length, 32);

  const chars = [...sampleChars(length, charset)];
  if (flags.getBool('require-each')) enforceEachClass(chars, charset);
  const text = applyCase(context, chars.join(''));

  return {
    value: text,
    fields: { length: text.length, charsetSize: charset.length },
    entropyBits: alphabetEntropyBits(text.length, charset.length),
  };
}

export const charsGenerator: Generator = {
  name: 'chars',
  summary: 'Random characters from a preset or custom charset',
  usage: 'chars [--charset <preset|list>] [--length <n>]',
  details: [
    'presets: alnum, alpha, lower, upper, digits, hex, symbols, safe, url-safe, base58.',
    `"safe" drops look-alike characters (${AMBIGUOUS.split('').join(' ')}).`,
    'Any other --charset value is a literal character list (duplicates are ignored).',
  ],
  examples: ['mint chars', 'mint chars --charset safe --length 24', 'mint chars --charset "abc123" --require-each'],
  flags: CHARSET_FLAGS,
  run: charsRun,
};

export const passwordGenerator: Generator = {
  name: 'password',
  summary: 'Strong random password with digits and symbols',
  usage: 'password [--length 20] [--no-ambiguous]',
  details: [
    'Always contains at least one lowercase, uppercase, digit and symbol character.',
    'Use --no-digits or --no-symbols to relax the character classes.',
  ],
  examples: ['mint password', 'mint password --length 32', 'mint password --no-ambiguous --length 24'],
  flags: [...CHARSET_FLAGS, 'digits', 'symbols'],
  run(context) {
    const flags = context.flags;
    const request = readSize(flags);

    let fallback = ALNUM + SYMBOLS;
    if (!flags.getBool('digits', true)) {
      fallback = [...fallback].filter((char) => char < '0' || char > '9').join('');
    }
    if (!flags.getBool('symbols', true)) {
      fallback = [...fallback].filter((char) => !SYMBOLS.includes(char)).join('');
    }

    const charset = resolveCharset(flags.getString('charset'), {
      exclude: [flags.getString('exclude') ?? '', flags.getBool('ambiguous', true) ? '' : AMBIGUOUS].join(''),
      fallback,
    });
    const length = lengthForBits(request, charset.length, 20);
    if (length < 4) throw new UsageError('--length must be at least 4 for a password');

    const chars = [...sampleChars(length, charset)];
    enforceEachClass(chars, charset);

    return {
      value: chars.join(''),
      fields: { length, charsetSize: charset.length },
      entropyBits: alphabetEntropyBits(length, charset.length),
    };
  },
};

export const pinGenerator: Generator = {
  name: 'pin',
  summary: 'Numeric PIN code',
  usage: 'pin [--length 6] [--no-leading-zero]',
  examples: ['mint pin', 'mint pin --length 4', 'mint pin --length 8 --no-leading-zero'],
  flags: ['length', 'size', 'bytes', 'bits', 'exclude', 'leading-zero'],
  run(context) {
    const flags = context.flags;
    const request = readSize(flags);
    const digits = resolveCharset('digits', { exclude: flags.getString('exclude'), fallback: DIGITS });
    const length = lengthForBits(request, digits.length, 6);

    const allowLeadingZero = flags.getBool('leading-zero', true);
    const firstAlphabet = allowLeadingZero ? digits : [...digits].filter((char) => char !== '0').join('');
    if (firstAlphabet.length === 0) {
      throw new UsageError('--no-leading-zero cannot be combined with excluding every non-zero digit');
    }

    const value = sampleChars(1, firstAlphabet) + sampleChars(length - 1, digits);
    return {
      value,
      fields: { length },
      entropyBits: Math.log2(firstAlphabet.length) + alphabetEntropyBits(length - 1, digits.length),
    };
  },
};
