import {
  BASE32_ALPHABET,
  BASE58_ALPHABET,
  BASE64URL_ALPHABET,
  CROCKFORD_ALPHABET,
  HEX_ALPHABET,
  encodeBase32,
  encodeBase58,
  encodeBase64,
  encodeCrockford,
  encodeHex,
  toBinaryString,
} from '../encodings.js';
import { UsageError } from '../errors.js';
import { assertExclusive } from '../specs.js';
import { alphabetEntropyBits, randomBytes, sampleChars } from '../random.js';
import { bitsToBytes, readSize } from '../size.js';
import type { GenContext, GenResult, Generator } from '../types.js';

export const ENCODING_FLAGS = ['hex', 'base64', 'base64url', 'base32', 'base58', 'crockford', 'binary'] as const;

export type Encoding = (typeof ENCODING_FLAGS)[number];

const STANDARD_BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const SAMPLE_ALPHABETS: Record<Encoding, string> = {
  hex: HEX_ALPHABET,
  base64: STANDARD_BASE64_ALPHABET,
  base64url: BASE64URL_ALPHABET,
  base32: BASE32_ALPHABET,
  base58: BASE58_ALPHABET,
  crockford: CROCKFORD_ALPHABET,
  binary: '01',
};

const RAW_FLAGS = [...ENCODING_FLAGS, 'length', 'size', 'bytes', 'bits', 'upper', 'lower', 'padding'] as const;

function resolveEncoding(context: GenContext, fallback: Encoding): Encoding {
  const chosen = assertExclusive(context.flags, ENCODING_FLAGS, 'encoding');
  return (chosen as Encoding | undefined) ?? fallback;
}

function resolveCase(context: GenContext, text: string, alphabet: string): string {
  const upper = context.flags.getBool('upper');
  const lower = context.flags.getBool('lower');
  if (upper && lower) throw new UsageError('use only one of --upper and --lower');
  if (lower && text !== text.toLowerCase() && alphabet === alphabet.toUpperCase()) return text.toLowerCase();
  if (upper && text !== text.toUpperCase()) return text.toUpperCase();
  return text;
}

function encodeWith(context: GenContext, encoding: Encoding, bytes: Buffer): string {
  const flags = context.flags;
  switch (encoding) {
    case 'hex':
      return encodeHex(bytes, { upper: flags.getBool('upper') });
    case 'base64':
      return encodeBase64(bytes, { padding: flags.getBool('padding', true) });
    case 'base64url':
      return encodeBase64(bytes, { url: true, padding: flags.getBool('padding', true) });
    case 'base32':
      return resolveCase(context, encodeBase32(bytes, { padding: flags.getBool('padding', true) }), BASE32_ALPHABET);
    case 'crockford':
      return resolveCase(context, encodeCrockford(bytes, { padding: flags.getBool('padding', false) }), CROCKFORD_ALPHABET);
    case 'base58':
      return encodeBase58(bytes);
    case 'binary':
      return toBinaryString(bytes, bytes.length * 8);
  }
}

function run(context: GenContext, fallback: Encoding, defaultBytes: number, defaultBits: number): GenResult {
  const encoding = resolveEncoding(context, fallback);
  const request = readSize(context.flags);

  if (encoding === 'binary') {
    const bits =
      request.mode === 'bits'
        ? request.bits!
        : request.mode === 'chars'
          ? request.chars!
          : request.mode === 'bytes'
            ? request.bytes! * 8
            : defaultBits;
    const bytes = randomBytes(bitsToBytes(bits));
    return {
      value: toBinaryString(bytes, bits),
      fields: { encoding, bits },
      entropyBits: bits,
    };
  }

  if (request.mode === 'chars') {
    const chars = request.chars!;
    const alphabet = SAMPLE_ALPHABETS[encoding];
    const text = resolveCase(context, sampleChars(chars, alphabet), alphabet);
    return {
      value: text,
      fields: { encoding, length: chars },
      entropyBits: alphabetEntropyBits(chars, alphabet.length),
    };
  }

  const byteCount = request.mode === 'bytes' ? request.bytes! : request.mode === 'bits' ? bitsToBytes(request.bits!) : defaultBytes;
  const bytes = randomBytes(byteCount);
  return {
    value: encodeWith(context, encoding, bytes),
    fields: { encoding, bytes: byteCount },
    entropyBits: byteCount * 8,
  };
}

interface RawVariant {
  name: string;
  encoding: Encoding;
  summary: string;
  defaultBytes: number;
  defaultBits: number;
  examples: string[];
}

const VARIANTS: readonly RawVariant[] = [
  {
    name: 'bytes',
    encoding: 'hex',
    summary: 'Random bytes, hex-encoded unless another encoding flag is given',
    defaultBytes: 32,
    defaultBits: 256,
    examples: ['mint 32', 'mint 32 --base64', 'mint bytes --bytes 16'],
  },
  {
    name: 'hex',
    encoding: 'hex',
    summary: 'Random bytes as lowercase hex (2 characters per byte)',
    defaultBytes: 32,
    defaultBits: 256,
    examples: ['mint hex', 'mint hex --bytes 32', 'mint hex --length 64 --upper'],
  },
  {
    name: 'base64',
    encoding: 'base64',
    summary: 'Random bytes as standard base64',
    defaultBytes: 32,
    defaultBits: 256,
    examples: ['mint base64', 'mint base64 --bytes 48'],
  },
  {
    name: 'base64url',
    encoding: 'base64url',
    summary: 'Random bytes as URL-safe base64 (no + or /)',
    defaultBytes: 32,
    defaultBits: 256,
    examples: ['mint base64url', 'mint base64url --length 43'],
  },
  {
    name: 'base32',
    encoding: 'base32',
    summary: 'Random bytes as RFC 4648 base32 (A-Z, 2-7)',
    defaultBytes: 32,
    defaultBits: 256,
    examples: ['mint base32', 'mint base32 --bytes 20 --no-padding'],
  },
  {
    name: 'base58',
    encoding: 'base58',
    summary: 'Random bytes as base58 (Bitcoin alphabet, no look-alikes)',
    defaultBytes: 32,
    defaultBits: 256,
    examples: ['mint base58', 'mint base58 --bytes 16'],
  },
  {
    name: 'crockford',
    encoding: 'crockford',
    summary: 'Random bytes as Crockford base32 (no I, L, O or U)',
    defaultBytes: 32,
    defaultBits: 256,
    examples: ['mint crockford', 'mint crockford --bytes 16'],
  },
  {
    name: 'binary',
    encoding: 'binary',
    summary: 'Random bits as a 0/1 string',
    defaultBytes: 32,
    defaultBits: 32,
    examples: ['mint binary', 'mint binary --bits 128'],
  },
];

export const rawGenerators: readonly Generator[] = VARIANTS.map((variant) => ({
  name: variant.name,
  summary: variant.summary,
  usage: `${variant.name} [--bytes <n> | --length <n> | --bits <n>]`,
  details: [
    '--bytes draws that many random bytes and encodes them (entropy = bytes x 8 bits).',
    '--length asks for an exact character count: characters are drawn uniformly from the',
    'encoding alphabet, so short or non-aligned lengths are still perfectly uniform.',
  ],
  examples: variant.examples,
  flags: RAW_FLAGS,
  run: (context) => run(context, variant.encoding, variant.defaultBytes, variant.defaultBits),
}));
