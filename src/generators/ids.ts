import { createHash } from 'node:crypto';
import { UsageError } from '../errors.js';
import {
  LOWER,
  URL_SAFE,
  resolveCharset,
} from '../charsets.js';
import { alphabetEntropyBits, randomBytes, randomIntBelow, sampleChar, sampleChars } from '../random.js';
import { BASE62_ALPHABET, CROCKFORD_ALPHABET, encodeBase62, encodeCrockford } from '../encodings.js';
import { charsForEntropy, readSize } from '../size.js';
import { requestedBits } from './chars.js';
import type { GenContext, Generator } from '../types.js';

const UUID_EPOCH_100NS = 122192928000000000n; // 1582-10-15 -> 1970-01-01 in 100ns ticks
const KSUID_EPOCH_SECONDS = 1400000000;
const SNOWFLAKE_EPOCH_MS = 1420070400000n;

function formatUuid(bytes: Buffer, options: { dashes?: boolean; upper?: boolean } = {}): string {
  const hex = bytes.toString('hex');
  const grouped = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ];
  const separator = options.dashes === false ? '' : '-';
  const text = grouped.join(separator);
  return options.upper ? text.toUpperCase() : text;
}

function uuidV4Bytes(): Buffer {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes;
}

function uuidV7Bytes(): Buffer {
  const bytes = randomBytes(16);
  const milliseconds = BigInt(Date.now());
  bytes[0] = Number((milliseconds >> 40n) & 0xffn);
  bytes[1] = Number((milliseconds >> 32n) & 0xffn);
  bytes[2] = Number((milliseconds >> 24n) & 0xffn);
  bytes[3] = Number((milliseconds >> 16n) & 0xffn);
  bytes[4] = Number((milliseconds >> 8n) & 0xffn);
  bytes[5] = Number(milliseconds & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes;
}

function uuidV1Bytes(): Buffer {
  const ticks = BigInt(Date.now()) * 10000n + UUID_EPOCH_100NS;
  const bytes = randomBytes(16);
  bytes.writeUInt32BE(Number(ticks & 0xffffffffn), 0);
  bytes.writeUInt16BE(Number((ticks >> 32n) & 0xffffn), 4);
  bytes.writeUInt16BE(0x1000 | Number((ticks >> 48n) & 0x0fffn), 6);
  const clockSequence = randomIntBelow(16384);
  bytes[8] = 0x80 | ((clockSequence >> 8) & 0x3f);
  bytes[9] = clockSequence & 0xff;
  const node = randomBytes(6);
  node[0] = node[0] | 0x01; // mark the node as random, not a real MAC address
  node.copy(bytes, 10);
  return bytes;
}

let cuidCounter = randomIntBelow(1679616);
const cuidFingerprint = sampleChars(4, `${LOWER}0123456789`);

function cuidValue(length: number): string {
  const timestamp = Date.now().toString(36);
  const counter = cuidCounter.toString(36);
  cuidCounter = (cuidCounter + 1) % 1679616;
  const noise = sampleChars(32, `${LOWER}0123456789`);
  const digest = createHash('sha512').update(`${timestamp}${counter}${cuidFingerprint}${noise}`).digest();
  let value = BigInt(`0x${digest.toString('hex')}`).toString(36).slice(0, length);
  if (!/^[a-z]/u.test(value[0])) value = sampleChar(LOWER) + value.slice(1);
  return value;
}

let objectIdCounter = randomIntBelow(16777216);
const objectIdProcessRandom = randomBytes(5);

let snowflakeSequence = randomIntBelow(4096);

const BASE36_DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

function base36(value: number, width: number): string {
  let text = '';
  let remaining = Math.max(0, Math.floor(value));
  do {
    text = BASE36_DIGITS[remaining % 36] + text;
    remaining = Math.floor(remaining / 36);
  } while (remaining > 0);
  return text.padStart(width, '0').slice(-width);
}

function sizeOrChars(context: GenContext, fallback: number, alphabetSize = 64): number {
  const request = readSize(context.flags);
  const bits = requestedBits(request);
  if (bits !== undefined) return charsForEntropy(bits, alphabetSize);
  return request.chars ?? fallback;
}

function uuidUppercase(context: GenContext): boolean {
  const upper = context.flags.getBool('upper');
  const lower = context.flags.getBool('lower');
  if (upper && lower) throw new UsageError('use only one of --upper and --lower');
  return upper;
}

export const uuidGenerator: Generator = {
  name: 'uuid',
  summary: 'RFC 9562 UUID (v4 random, v7 sortable, v1 timestamp, nil)',
  usage: 'uuid [--v7 | --v1 | --nil] [--upper] [--no-dashes]',
  details: ['v4 (default) carries 122 random bits.', 'v7 carries a 48-bit timestamp plus 74 random bits.'],
  examples: ['mint uuid', 'mint uuid --v7', 'mint uuid --no-dashes --upper'],
  flags: ['v1', 'v4', 'v7', 'nil', 'dashes', 'upper', 'lower'],
  run(context) {
    const flags = context.flags;
    const variant = ['v1', 'v4', 'v7', 'nil'].filter((name) => flags.getBool(name));
    if (variant.length > 1) {
      throw new UsageError(`use only one UUID version (got ${variant.map((name) => `--${name}`).join(', ')})`);
    }
    const chosen = variant[0] ?? 'v4';
    const dashes = flags.getBool('dashes', true);
    const upper = uuidUppercase(context);

    if (chosen === 'nil') {
      return { value: formatUuid(Buffer.alloc(16), { dashes, upper }), fields: { version: 'nil' }, entropyBits: 0 };
    }
    if (chosen === 'v7') {
      return {
        value: formatUuid(uuidV7Bytes(), { dashes, upper }),
        fields: { version: 7 },
        entropyBits: 74,
      };
    }
    if (chosen === 'v1') {
      return {
        value: formatUuid(uuidV1Bytes(), { dashes, upper }),
        fields: { version: 1 },
        entropyBits: 61,
      };
    }
    return {
      value: formatUuid(uuidV4Bytes(), { dashes, upper }),
      fields: { version: 4 },
      entropyBits: 122,
    };
  },
};

export const ulidGenerator: Generator = {
  name: 'ulid',
  summary: 'ULID: 48-bit timestamp + 80 random bits, Crockford base32',
  usage: 'ulid [--lower]',
  examples: ['mint ulid', 'mint ulid --lower'],
  flags: ['upper', 'lower'],
  run(context) {
    const upper = context.flags.getBool('upper');
    const lower = context.flags.getBool('lower');
    if (upper && lower) throw new UsageError('use only one of --upper and --lower');

    const now = Date.now();
    let time = BigInt(now);
    let timePart = '';
    for (let index = 0; index < 10; index++) {
      timePart = CROCKFORD_ALPHABET[Number(time % 32n)] + timePart;
      time /= 32n;
    }
    const randomPart = encodeCrockford(randomBytes(10));
    const value = timePart + randomPart;
    return {
      value: lower ? value.toLowerCase() : value,
      fields: { timestamp: now },
      entropyBits: 80,
    };
  },
};

export const ksuidGenerator: Generator = {
  name: 'ksuid',
  summary: 'KSUID: 4-byte timestamp + 16 random bytes, base62',
  usage: 'ksuid [--format base62|hex]',
  examples: ['mint ksuid', 'mint ksuid --format hex'],
  flags: ['format'],
  run(context) {
    const format = context.flags.getEnum('format', ['base62', 'hex'] as const) ?? 'base62';
    const bytes = randomBytes(20);
    const seconds = BigInt(Math.floor(Date.now() / 1000) - KSUID_EPOCH_SECONDS);
    bytes.writeUInt32BE(Number(seconds & 0xffffffffn), 0);
    const value = format === 'hex' ? bytes.toString('hex') : encodeBase62(bytes, 27);
    return { value, fields: { format, alphabet: format === 'hex' ? 16 : BASE62_ALPHABET.length }, entropyBits: 128 };
  },
};

export const nanoidGenerator: Generator = {
  name: 'nanoid',
  summary: 'Nano ID: compact URL-safe identifier (21 chars, 64-symbol alphabet)',
  usage: 'nanoid [--size 21] [--alphabet <chars>]',
  examples: ['mint nanoid', 'mint nanoid --size 12', 'mint nanoid --alphabet "0123456789abcdef"'],
  flags: ['size', 'length', 'alphabet', 'bytes', 'bits', 'upper', 'lower'],
  run(context) {
    const flags = context.flags;
    const alphabet = resolveCharset(flags.getString('alphabet'), { fallback: URL_SAFE });
    const size = sizeOrChars(context, 21, alphabet.length);
    let value = sampleChars(size, alphabet);
    if (flags.getBool('upper')) value = value.toUpperCase();
    else if (flags.getBool('lower')) value = value.toLowerCase();
    return {
      value,
      fields: { size: value.length, alphabetSize: alphabet.length },
      entropyBits: alphabetEntropyBits(value.length, alphabet.length),
    };
  },
};

export const cuidGenerator: Generator = {
  name: 'cuid',
  summary: 'cuid2-style collision-resistant id (SHA-512, base36)',
  usage: 'cuid [--length 24]',
  details: [
    'Like cuid2, the value is a truncated SHA-512 digest over a timestamp, a per-process',
    'counter, a random per-process fingerprint and 160 fresh random bits: it is not',
    'reversible to any of those inputs, and its first character is always a letter.',
  ],
  examples: ['mint cuid', 'mint cuid --length 32'],
  flags: ['length', 'size', 'bytes', 'bits'],
  run(context) {
    const length = sizeOrChars(context, 24, 36);
    if (length < 2 || length > 64) throw new UsageError('--length for cuid must be between 2 and 64');
    return {
      value: cuidValue(length),
      fields: { length },
      entropyBits: alphabetEntropyBits(length, 36),
    };
  },
};

export const uidGenerator: Generator = {
  name: 'uid',
  summary: 'Short URL-safe unique id, optionally time-sortable',
  usage: 'uid [--length 16] [--sortable]',
  examples: ['mint uid', 'mint uid --sortable', 'mint uid --length 24'],
  flags: ['length', 'size', 'sortable', 'bytes', 'bits', 'alphabet'],
  run(context) {
    const alphabet = resolveCharset(context.flags.getString('alphabet'), { fallback: URL_SAFE });
    const sortable = context.flags.getBool('sortable');
    const minimum = sortable ? 9 : 1;
    const requested = sizeOrChars(context, 16, alphabet.length);
    const length = Math.max(requested, minimum);
    const stamp = sortable ? base36(Date.now(), 8) : '';
    const value = stamp + sampleChars(length - stamp.length, alphabet);
    return {
      value,
      fields: { length: value.length, sortable, alphabetSize: alphabet.length },
      entropyBits: alphabetEntropyBits(value.length - stamp.length, alphabet.length),
    };
  },
};

export const objectIdGenerator: Generator = {
  name: 'objectid',
  summary: 'MongoDB-style 12-byte ObjectId (24 hex characters)',
  usage: 'objectid [--upper]',
  examples: ['mint objectid'],
  flags: ['upper', 'lower'],
  run(context) {
    const bytes = Buffer.alloc(12);
    bytes.writeUInt32BE(Math.floor(Date.now() / 1000) >>> 0, 0);
    objectIdProcessRandom.copy(bytes, 4);
    bytes.writeUIntBE(objectIdCounter, 9, 3);
    objectIdCounter = (objectIdCounter + 1) % 16777216;
    const value = uuidUppercase(context) ? bytes.toString('hex').toUpperCase() : bytes.toString('hex');
    return { value, fields: { bytes: 12 }, entropyBits: 64 };
  },
};

export const snowflakeGenerator: Generator = {
  name: 'snowflake',
  summary: 'Twitter-style 64-bit snowflake id (time + worker + sequence)',
  usage: 'snowflake [--worker 0-1023]',
  examples: ['mint snowflake', 'mint snowflake --worker 7'],
  flags: ['worker'],
  run(context) {
    const worker = context.flags.getInt('worker', { min: 0, max: 1023 }) ?? randomIntBelow(1024);
    snowflakeSequence = (snowflakeSequence + 1) & 0xfff;
    const elapsed = BigInt(Date.now()) - SNOWFLAKE_EPOCH_MS;
    const id = (elapsed << 22n) | (BigInt(worker) << 12n) | BigInt(snowflakeSequence);
    return { value: id.toString(), fields: { worker, sequence: snowflakeSequence }, entropyBits: 22 };
  },
};

export const typeIdGenerator: Generator = {
  name: 'typeid',
  summary: 'TypeID: type prefix + UUIDv7 in Crockford base32 (user_01h455...)',
  usage: 'typeid [<type>] [--type user]',
  examples: ['mint typeid', 'mint typeid user', 'mint typeid --type org'],
  flags: ['type'],
  acceptsPositionals: true,
  run(context) {
    const fromPositional = context.positionals[0];
    const type = fromPositional ?? context.flags.getString('type') ?? 'id';
    if (type.length > 63) throw new UsageError('typeid type must be at most 63 characters');
    if (!/^[a-z](?:[a-z0-9]*)$/u.test(type)) {
      throw new UsageError(`typeid type "${type}" must be lowercase letters and digits, starting with a letter`);
    }
    const suffix = encodeCrockford(uuidV7Bytes()).toLowerCase();
    return { value: `${type}_${suffix}`, fields: { type, length: suffix.length }, entropyBits: 74 };
  },
};
