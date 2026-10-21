import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { UsageError } from '../errors.js';
import type { Generator } from '../types.js';

/**
 * Asymmetric key pairs. mint generates the keys with node:crypto and prints PEM,
 * so the private material only ever goes to stdout - no files, no network.
 */

const RSA_SIZES = [2048, 3072, 4096] as const;

function exportPem(key: KeyObject, kind: 'private' | 'public'): string {
  return key.export({ type: kind === 'private' ? 'pkcs8' : 'spki', format: 'pem' }).toString();
}

function uint32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value, 0);
  return buffer;
}

/** `ssh-ed25519 AAAA... comment`, the format authorized_keys expects. */
export function opensshEd25519Public(key: KeyObject, comment: string): string {
  const jwk = key.export({ format: 'jwk' }) as { kty?: string; crv?: string; x?: string };
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || typeof jwk.x !== 'string') {
    throw new UsageError('--openssh only supports ed25519 keys');
  }
  const raw = Buffer.from(jwk.x, 'base64url');
  const type = Buffer.from('ssh-ed25519', 'utf8');
  const blob = Buffer.concat([uint32(type.length), type, uint32(raw.length), raw]);
  const suffix = comment === '' ? '' : ` ${comment}`;
  return `ssh-ed25519 ${blob.toString('base64')}${suffix}`;
}

export const keypairGenerator: Generator = {
  name: 'keypair',
  summary: 'Asymmetric key pair (Ed25519 or RSA) as PEM',
  usage: 'keypair [--type ed25519|rsa] [--bits 2048] [--public | --openssh]',
  details: [
    'The default output is the PKCS#8 private key PEM. --public prints the SPKI public key',
    'instead, and --openssh prints an ssh-ed25519 line for authorized_keys.',
    'Ed25519 is the default; --bits (2048, 3072 or 4096) selects the RSA key size.',
    'The private key is printed to stdout and nowhere else - mint writes no files.',
  ],
  examples: ['mint keypair', 'mint keypair --public', 'mint keypair --openssh --comment me@host', 'mint keypair --type rsa --bits 4096 --public'],
  flags: ['type', 'bits', 'public', 'openssh', 'comment'],
  run(context) {
    const flags = context.flags;
    const type = flags.getEnum('type', ['ed25519', 'rsa'] as const) ?? 'ed25519';
    const openssh = flags.getBool('openssh');
    const publicOnly = flags.getBool('public') || openssh;

    if (type === 'ed25519' && flags.has('bits')) {
      throw new UsageError('--bits only applies to RSA keys; ed25519 keys are always 256-bit');
    }
    if (openssh && type !== 'ed25519') {
      throw new UsageError('--openssh only supports ed25519 keys', 'use --public for an RSA public key in PEM');
    }

    let bits: number;
    if (type === 'rsa') {
      bits = flags.getInt('bits', { min: 2048, max: 4096 }) ?? 2048;
      if (!(RSA_SIZES as readonly number[]).includes(bits)) {
        throw new UsageError(`RSA keys must be ${RSA_SIZES.join(', ')} bits, got ${String(bits)}`);
      }
    } else {
      bits = 256;
    }

    const { privateKey, publicKey } =
      type === 'ed25519' ? generateKeyPairSync('ed25519') : generateKeyPairSync('rsa', { modulusLength: bits });

    const privatePem = exportPem(privateKey, 'private');
    const publicPem = exportPem(publicKey, 'public');

    let value: string;
    if (openssh) value = opensshEd25519Public(publicKey, flags.getString('comment') ?? 'mint');
    else if (publicOnly) value = publicPem;
    else value = privatePem;

    return {
      value,
      fields: { type, bits, publicKey: publicPem, privateKey: privatePem },
      entropyBits: bits,
    };
  },
};
