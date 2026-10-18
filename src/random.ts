import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { UsageError } from './errors.js';

export const MAX_BYTES = 1024 * 1024;
export const MAX_LENGTH = 1_000_000;

const UINT32_RANGE = 2 ** 32;

/** Cryptographically secure random bytes. The only entropy source in mint. */
export function randomBytes(size: number): Buffer {
  if (!Number.isInteger(size) || size < 0) {
    throw new UsageError(`invalid byte count: ${size}`);
  }
  if (size > MAX_BYTES) {
    throw new UsageError(`byte count ${size} is too large (max ${MAX_BYTES})`);
  }
  return nodeRandomBytes(size);
}

/** Uniform integer in [0, maxExclusive) using rejection sampling (no modulo bias). */
export function randomIntBelow(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
    throw new UsageError(`invalid random range size: ${maxExclusive}`);
  }
  if (maxExclusive === 1) return 0;
  const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  const buffer = Buffer.allocUnsafe(4);
  for (;;) {
    nodeRandomBytes(4).copy(buffer);
    const value = buffer.readUInt32BE(0);
    if (value < limit) return value % maxExclusive;
  }
}

/** Uniform bigint in [0, maxExclusive), rejection sampled over the minimal byte width. */
export function randomBigIntBelow(maxExclusive: bigint): bigint {
  if (maxExclusive <= 0n) throw new UsageError(`invalid random range size: ${maxExclusive}`);
  const bitLength = (maxExclusive - 1n).toString(2).length;
  const byteLength = Math.ceil(bitLength / 8);
  const excessBits = byteLength * 8 - bitLength;
  for (;;) {
    const bytes = nodeRandomBytes(byteLength);
    if (excessBits > 0) bytes[0] = bytes[0] & (0xff >>> excessBits);
    let value = 0n;
    for (const byte of bytes) value = (value << 8n) | BigInt(byte);
    if (value < maxExclusive) return value;
  }
}

/** Uniform integer in [min, max] (inclusive), bias-free. */
export function randomInRange(min: number, max: number): number {
  if (max < min) throw new UsageError(`max (${max}) must be greater than or equal to min (${min})`);
  return min + randomIntBelow(max - min + 1);
}

/** Uniform bigint in [min, max] (inclusive). */
export function randomBigIntInRange(min: bigint, max: bigint): bigint {
  if (max < min) throw new UsageError(`max (${max}) must be greater than or equal to min (${min})`);
  return min + randomBigIntBelow(max - min + 1n);
}

export function bigIntFromBytes(bytes: Buffer): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

/**
 * Pick `count` characters from `charset`, uniformly and independently.
 *
 * Bytes are consumed through rejection sampling: any byte >= floor(256 / k) * k is
 * discarded, so every character in the charset is exactly equally likely. For
 * charsets whose size divides 256 (16, 32, 64, 128) nothing is ever discarded.
 */
export function sampleChars(count: number, charset: string): string {
  const k = charset.length;
  if (k < 2) {
    throw new UsageError('charset must contain at least 2 distinct characters');
  }
  if (count < 1) {
    throw new UsageError('length must be at least 1');
  }
  if (count > MAX_LENGTH) {
    throw new UsageError(`length ${count} is too large (max ${MAX_LENGTH})`);
  }
  const limit = 256 - (256 % k);
  const out = new Array<string>(count);
  let filled = 0;
  while (filled < count) {
    const wanted = Math.ceil((count - filled) * 1.25);
    const batch = nodeRandomBytes(Math.min(MAX_BYTES, Math.max(64, wanted)));
    for (let i = 0; i < batch.length && filled < count; i++) {
      const byte = batch[i];
      if (byte >= limit) continue;
      out[filled++] = charset[byte % k];
    }
  }
  return out.join('');
}

/** Uniform single character from `charset`. */
export function sampleChar(charset: string): string {
  return charset[randomIntBelow(charset.length)];
}

/** Uniform single element of `items`. */
export function sampleOne<T>(items: readonly T[]): T {
  if (items.length === 0) throw new UsageError('cannot pick from an empty list');
  return items[randomIntBelow(items.length)];
}

/** Fisher-Yates shuffle driven by the CSPRNG. Returns a new array. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomIntBelow(i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** `count` distinct elements, in random order. Requires count <= items.length. */
export function sampleMany<T>(items: readonly T[], count: number): T[] {
  if (count > items.length) {
    throw new UsageError(`cannot pick ${count} distinct items out of ${items.length}`);
  }
  return shuffle(items).slice(0, count);
}

/** Shannon entropy in bits for a uniform draw of `count` symbols from an alphabet of `alphabetSize`. */
export function alphabetEntropyBits(count: number, alphabetSize: number): number {
  if (alphabetSize < 2) return 0;
  return count * Math.log2(alphabetSize);
}
