import { UsageError } from './errors.js';
import type { Flags } from './flags.js';

export type SizeMode = 'chars' | 'bytes' | 'bits' | 'default';

export interface SizeRequest {
  mode: SizeMode;
  /** Requested character count (--length / --size). */
  chars: number | undefined;
  /** Requested byte count (--bytes). */
  bytes: number | undefined;
  /** Requested bit count (--bits). */
  bits: number | undefined;
}

export const MAX_BYTES = 1024 * 1024;
export const MAX_CHARS = 1_000_000;

/** Read `--length` / `--size` / `--bytes` / `--bits`, rejecting contradictory combinations. */
export function readSize(flags: Flags): SizeRequest {
  if (flags.has('length') && flags.has('size')) {
    throw new UsageError('use only one of --length and --size');
  }
  const chars = flags.getSize('length', { max: MAX_CHARS }) ?? flags.getSize('size', { max: MAX_CHARS });
  const bytes = flags.getSize('bytes', { max: MAX_BYTES });
  const bits = flags.getSize('bits', { max: MAX_BYTES * 8 });

  const given = [chars, bytes, bits].filter((value) => value !== undefined).length;
  if (given > 1) {
    throw new UsageError('use only one of --length, --bytes or --bits');
  }

  if (chars !== undefined) return { mode: 'chars', chars, bytes: undefined, bits: undefined };
  if (bytes !== undefined) return { mode: 'bytes', chars: undefined, bytes, bits: undefined };
  if (bits !== undefined) return { mode: 'bits', chars: undefined, bytes: undefined, bits };
  return { mode: 'default', chars: undefined, bytes: undefined, bits: undefined };
}

export function bitsToBytes(bits: number): number {
  return Math.max(1, Math.ceil(bits / 8));
}

/** Smallest character count that reaches `bits` of entropy over an alphabet of `alphabetSize` symbols. */
export function charsForEntropy(bits: number, alphabetSize: number): number {
  if (alphabetSize < 2) throw new UsageError('alphabet must contain at least 2 symbols');
  if (!Number.isFinite(bits) || bits <= 0) throw new UsageError(`invalid entropy target: ${bits}`);
  return Math.max(1, Math.ceil(bits / Math.log2(alphabetSize)));
}

/** Bytes to draw for a request, given the generator's default byte count. */
export function resolveBytes(request: SizeRequest, defaultBytes: number): number {
  if (request.mode === 'bytes') return request.bytes!;
  if (request.mode === 'bits') return bitsToBytes(request.bits!);
  return defaultBytes;
}
