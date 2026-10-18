import { bigIntFromBytes } from './random.js';
import { UsageError } from './errors.js';

export const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const HEX_ALPHABET = '0123456789abcdef';

/**
 * Encode bytes into a power-of-two alphabet, reading `bitsPerChar` bits at a time.
 * Deterministic, bijective: entropy in equals entropy out.
 */
export function encodePowerOfTwo(
  bytes: Buffer,
  alphabet: string,
  bitsPerChar: number,
  options: { padTo?: number; padChar?: string } = {},
): string {
  const mask = (1 << bitsPerChar) - 1;
  let out = '';
  let accumulator = 0;
  let bitCount = 0;
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    bitCount += 8;
    while (bitCount >= bitsPerChar) {
      bitCount -= bitsPerChar;
      out += alphabet[(accumulator >>> bitCount) & mask];
    }
  }
  if (bitCount > 0) {
    out += alphabet[(accumulator << (bitsPerChar - bitCount)) & mask];
  }
  if (options.padTo && options.padChar) {
    while (out.length % options.padTo !== 0) out += options.padChar;
  }
  return out;
}

export function encodeHex(bytes: Buffer, options: { upper?: boolean } = {}): string {
  const text = bytes.toString('hex');
  return options.upper ? text.toUpperCase() : text;
}

export function encodeBase64(bytes: Buffer, options: { url?: boolean; padding?: boolean } = {}): string {
  const text = bytes.toString(options.url ? 'base64url' : 'base64');
  if (options.padding === false) return text.replace(/=+$/u, '');
  return text;
}

/** RFC 4648 base32. Padded to a multiple of 8 characters unless padding is disabled. */
export function encodeBase32(bytes: Buffer, options: { padding?: boolean; upper?: boolean } = {}): string {
  const text = encodePowerOfTwo(bytes, BASE32_ALPHABET, 5, {
    padTo: options.padding === false ? undefined : 8,
    padChar: '=',
  });
  return options.upper === false ? text.toLowerCase() : text;
}

/** Crockford base32: excludes I, L, O and U. Unpadded by default. */
export function encodeCrockford(bytes: Buffer, options: { padding?: boolean; upper?: boolean } = {}): string {
  const text = encodePowerOfTwo(bytes, CROCKFORD_ALPHABET, 5, {
    padTo: options.padding ? 8 : undefined,
    padChar: '=',
  });
  return options.upper === false ? text.toLowerCase() : text;
}

/** Bitcoin base58: big-integer conversion, leading zero bytes become leading '1'. */
export function encodeBase58(bytes: Buffer): string {
  let value = bigIntFromBytes(bytes);
  let out = '';
  while (value > 0n) {
    out = BASE58_ALPHABET[Number(value % 58n)] + out;
    value /= 58n;
  }
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros++;
  return '1'.repeat(leadingZeros) + out;
}

/** Base62 (Bitcoin-ish alphabet), fixed output width, used for KSUID. */
export function encodeBase62(bytes: Buffer, width: number): string {
  let value = bigIntFromBytes(bytes);
  let out = '';
  while (value > 0n) {
    out = BASE62_ALPHABET[Number(value % 62n)] + out;
    value /= 62n;
  }
  return out.padStart(width, '0');
}

export function decodeBase58(text: string): Buffer {
  let value = 0n;
  for (const char of text) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index < 0) throw new UsageError(`"${char}" is not a base58 character`);
    value = value * 58n + BigInt(index);
  }
  const hex = value.toString(16).padStart(2, '0');
  const body = Buffer.from(hex.length % 2 === 0 ? hex : '0' + hex, 'hex');
  let leadingZeros = 0;
  while (leadingZeros < text.length && text[leadingZeros] === '1') leadingZeros++;
  return Buffer.concat([Buffer.alloc(leadingZeros), body]);
}

export function decodeBase32(text: string, alphabet: string = BASE32_ALPHABET): Buffer {
  const clean = text.replace(/=+$/u, '').toUpperCase();
  const bits: number[] = [];
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new UsageError(`"${char}" is not a valid base32 character`);
    for (let bit = 4; bit >= 0; bit--) bits.push((index >>> bit) & 1);
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit++) byte = (byte << 1) | bits[i + bit];
    bytes.push(byte);
  }
  return Buffer.from(bytes);
}

export function toBinaryString(bytes: Buffer, bits: number): string {
  let out = '';
  for (const byte of bytes) {
    out += byte.toString(2).padStart(8, '0');
    if (out.length >= bits) break;
  }
  return out.slice(0, bits);
}
