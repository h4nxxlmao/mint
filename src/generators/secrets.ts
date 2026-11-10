import { createHash } from 'node:crypto';
import { UsageError } from '../errors.js';
import {
  encodeBase32,
  encodeBase58,
  encodeBase64,
  encodeCrockford,
  encodeHex,
  toBinaryString,
} from '../encodings.js';
import { alphabetEntropyBits, randomBytes, sampleChars } from '../random.js';
import { charsForEntropy, readSize } from '../size.js';
import { requestedBits } from './chars.js';
import type { GenContext, GenResult, Generator } from '../types.js';

export const SECRET_FORMATS = ['hex', 'base64', 'base64url', 'base32', 'base58', 'crockford', 'binary'] as const;
type SecretFormat = (typeof SECRET_FORMATS)[number];

const SAMPLE_ALPHABETS: Record<SecretFormat, string> = {
  hex: '0123456789abcdef',
  base64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
  base64url: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
  base32: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  base58: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
  crockford: '0123456789ABCDEFGHJKMNPQRSTVWXYZ',
  binary: '01',
};

export function encodeSecret(bytes: Buffer, format: SecretFormat, upper = false): string {
  switch (format) {
    case 'hex':
      return encodeHex(bytes, { upper });
    case 'base64':
      return encodeBase64(bytes);
    case 'base64url':
      return encodeBase64(bytes, { url: true });
    case 'base32':
      return encodeBase32(bytes, { padding: false });
    case 'base58':
      return encodeBase58(bytes);
    case 'crockford':
      return encodeCrockford(bytes);
    case 'binary':
      return toBinaryString(bytes, bytes.length * 8);
  }
}

function readFormat(context: GenContext, fallback: SecretFormat): SecretFormat {
  return context.flags.getEnum('format', SECRET_FORMATS) ?? fallback;
}

/** Secret of `defaultBytes` random bytes, encoded in the requested format. `--length` samples characters directly. */
function byteSecret(context: GenContext, options: { defaultBytes: number; format: SecretFormat }): GenResult {
  const flags = context.flags;
  const format = readFormat(context, options.format);
  const request = readSize(flags);
  const upper = flags.getBool('upper');

  if (request.mode === 'chars') {
    const alphabet = SAMPLE_ALPHABETS[format];
    const text = sampleChars(request.chars!, alphabet);
    return {
      value: upper ? text.toUpperCase() : text,
      fields: { format, length: text.length },
      entropyBits: alphabetEntropyBits(text.length, alphabet.length),
    };
  }

  const wanted = requestedBits(request);
  const byteCount = request.mode === 'bytes' ? request.bytes! : wanted !== undefined ? Math.ceil(wanted / 8) : options.defaultBytes;
  const bytes = randomBytes(byteCount);
  return {
    value: encodeSecret(bytes, format, upper),
    fields: { format, bytes: byteCount },
    entropyBits: byteCount * 8,
  };
}

const BYTE_SECRET_FLAGS = ['length', 'size', 'bytes', 'bits', 'format', 'upper'] as const;

export const nonceGenerator: Generator = {
  name: 'nonce',
  summary: 'Random nonce for AEAD ciphers (12 bytes, base64url)',
  usage: 'nonce [--bytes 12] [--format base64url]',
  details: [
    'AES-GCM and ChaCha20-Poly1305 use a 96-bit nonce. Generate a fresh one for every',
    'message: reusing a nonce with the same key breaks confidentiality and integrity.',
  ],
  examples: ['mint nonce', 'mint nonce --format hex', 'mint nonce --count 3'],
  flags: BYTE_SECRET_FLAGS,
  run: (context) => byteSecret(context, { defaultBytes: 12, format: 'base64url' }),
};

export const totpSecretGenerator: Generator = {
  name: 'totp-secret',
  summary: 'TOTP/HOTP shared secret (base32, RFC 4226)',
  usage: 'totp-secret [--bytes 20] [--format base32|hex|base64]',
  details: [
    'RFC 4226 recommends at least 128 bits for an HOTP/TOTP shared secret; the default',
    'is 160 bits (20 bytes), the size most authenticator apps expect.',
    'Base32 output is uppercase and unpadded, ready to paste into an app or otpauth URI.',
  ],
  examples: ['mint totp-secret', 'mint totp-secret --bytes 32', 'mint totp-secret --format hex'],
  flags: BYTE_SECRET_FLAGS,
  run: (context) => byteSecret(context, { defaultBytes: 20, format: 'base32' }),
};

export const otpauthGenerator: Generator = {
  name: 'otpauth',
  summary: 'otpauth:// provisioning URI with a fresh TOTP secret',
  usage: 'otpauth [--issuer <name>] [--account <name>] [--algo sha1|sha256|sha512] [--code-digits 6|8] [--period 30]',
  details: [
    'Builds the URI authenticator apps understand, around a new 160-bit base32 secret.',
    'Issuer and account are percent-encoded, so spaces, colons and unicode are safe.',
    'The secret is printed once inside the URI and never written anywhere.',
  ],
  examples: [
    'mint otpauth --issuer GitHub --account me@example.com',
    'mint otpauth --issuer "Acme Corp" --algo sha256 --code-digits 8',
    'mint otpauth --issuer Acme --json',
  ],
  flags: ['issuer', 'account', 'algo', 'code-digits', 'period', 'bytes', 'bits'],
  run(context) {
    const flags = context.flags;
    const issuer = flags.getString('issuer');
    const account = flags.getString('account') ?? 'mint';
    const algorithm = (flags.getEnum('algo', ['sha1', 'sha256', 'sha512'] as const) ?? 'sha1').toUpperCase();
    const digits = flags.getInt('code-digits', { min: 6, max: 8 }) ?? 6;
    if (digits !== 6 && digits !== 8) {
      throw new UsageError(`--code-digits must be 6 or 8, got ${String(digits)}`);
    }
    const period = flags.getInt('period', { min: 1, max: 300 }) ?? 30;

    const request = readSize(flags);
    const wanted = requestedBits(request);
    const byteCount = request.mode === 'bytes' ? request.bytes! : wanted !== undefined ? Math.ceil(wanted / 8) : 20;
    const secret = encodeBase32(randomBytes(byteCount), { padding: false });

    const label = issuer === undefined || issuer === ''
      ? encodeURIComponent(account)
      : `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
    const query: string[] = [`secret=${secret}`];
    if (issuer !== undefined && issuer !== '') query.push(`issuer=${encodeURIComponent(issuer)}`);
    query.push(`algorithm=${algorithm}`, `digits=${String(digits)}`, `period=${String(period)}`);
    const uri = `otpauth://totp/${label}?${query.join('&')}`;

    return {
      value: uri,
      fields: { secret, issuer: issuer ?? '', account, algorithm, digits, period },
      entropyBits: byteCount * 8,
    };
  },
};

export const jwtSecretGenerator: Generator = {
  name: 'jwt-secret',
  summary: 'JWT signing secret sized for HS256/HS384/HS512',
  usage: 'jwt-secret [--algo hs256|hs384|hs512] [--format base64url]',
  details: ['HS256 -> 32 bytes, HS384 -> 48 bytes, HS512 -> 64 bytes.', 'RFC 7518 requires a key at least as long as the hash output.'],
  examples: ['mint jwt-secret', 'mint jwt-secret --algo hs512', 'mint jwt-secret --format hex'],
  flags: [...BYTE_SECRET_FLAGS, 'algo'],
  run(context) {
    const algo = context.flags.getEnum('algo', ['hs256', 'hs384', 'hs512'] as const) ?? 'hs256';
    const bytes = algo === 'hs512' ? 64 : algo === 'hs384' ? 48 : 32;
    const result = byteSecret(context, { defaultBytes: bytes, format: 'base64url' });
    return { ...result, fields: { ...result.fields, algo } };
  },
};

export const tokenGenerator: Generator = {
  name: 'token',
  summary: 'Generic URL-safe bearer token',
  usage: 'token [--bytes 32] [--format base64url]',
  examples: ['mint token', 'mint token --format hex', 'mint token --length 64'],
  flags: BYTE_SECRET_FLAGS,
  run: (context) => byteSecret(context, { defaultBytes: 32, format: 'base64url' }),
};

export const saltGenerator: Generator = {
  name: 'salt',
  summary: 'Random salt for password hashing',
  usage: 'salt [--bytes 16] [--format hex]',
  examples: ['mint salt', 'mint salt --bytes 32', 'mint salt --format base64'],
  flags: BYTE_SECRET_FLAGS,
  run: (context) => byteSecret(context, { defaultBytes: 16, format: 'hex' }),
};

export const sessionGenerator: Generator = {
  name: 'session',
  summary: 'Session id (256-bit, URL-safe)',
  usage: 'session [--bytes 32]',
  examples: ['mint session', 'mint session --bytes 48'],
  flags: BYTE_SECRET_FLAGS,
  run: (context) => byteSecret(context, { defaultBytes: 32, format: 'base64url' }),
};

export const hmacGenerator: Generator = {
  name: 'hmac',
  summary: 'HMAC signing key sized for sha256 or sha512',
  usage: 'hmac [--algo sha256|sha512] [--format hex]',
  details: ['RFC 2104 recommends a key at least as long as the hash output, so 32 bytes for', 'sha256 and 64 bytes for sha512.'],
  examples: ['mint hmac', 'mint hmac --algo sha512'],
  flags: [...BYTE_SECRET_FLAGS, 'algo'],
  run(context) {
    const algo = context.flags.getEnum('algo', ['sha256', 'sha384', 'sha512'] as const) ?? 'sha256';
    const bytes = algo === 'sha512' ? 64 : algo === 'sha384' ? 48 : 32;
    const result = byteSecret(context, { defaultBytes: bytes, format: 'hex' });
    return { ...result, fields: { ...result.fields, algo } };
  },
};

export const aesGenerator: Generator = {
  name: 'aes',
  summary: 'AES key (128/192/256-bit) with optional IV',
  usage: 'aes [--bits 256] [--iv] [--format hex]',
  details: [
    '--bits is the AES key size: 128, 192 or 256.',
    '--iv prints key and IV as "key:iv" (a colon can never occur in any of the formats).',
  ],
  examples: ['mint aes', 'mint aes --bits 128 --iv', 'mint aes --format base64'],
  flags: [...BYTE_SECRET_FLAGS, 'iv'],
  run(context) {
    const flags = context.flags;
    const request = readSize(flags);
    const withIv = flags.getBool('iv');
    const format = readFormat(context, 'hex');

    let keyBytes: number;
    if (request.mode === 'bits') {
      if (![128, 192, 256].includes(request.bits!)) {
        throw new UsageError(`AES key size must be 128, 192 or 256 bits, got ${request.bits}`);
      }
      keyBytes = request.bits! / 8;
    } else if (request.mode === 'bytes') {
      if (![16, 24, 32].includes(request.bytes!)) {
        throw new UsageError(`AES key size must be 16, 24 or 32 bytes, got ${request.bytes}`);
      }
      keyBytes = request.bytes!;
    } else if (request.mode === 'chars') {
      return aesFromChars(request.chars!, format, withIv);
    } else {
      keyBytes = 32;
    }

    const key = encodeSecret(randomBytes(keyBytes), format);
    const iv = withIv ? encodeSecret(randomBytes(16), format) : undefined;
    return {
      value: iv === undefined ? key : `${key}:${iv}`,
      fields: iv === undefined ? { format, bits: keyBytes * 8 } : { format, bits: keyBytes * 8, key, iv },
      entropyBits: keyBytes * 8 + (iv ? 128 : 0),
    };
  },
};

function aesFromChars(chars: number, format: SecretFormat, withIv: boolean): GenResult {
  const alphabet = SAMPLE_ALPHABETS[format];
  const key = sampleChars(chars, alphabet);
  const iv = withIv ? sampleChars(16, alphabet) : undefined;
  const fields: Record<string, string | number | boolean> = { format, length: chars };
  if (iv !== undefined) {
    fields.key = key;
    fields.iv = iv;
  }
  return {
    value: iv === undefined ? key : `${key}:${iv}`,
    fields,
    entropyBits: alphabetEntropyBits(chars, alphabet.length) + (iv ? alphabetEntropyBits(16, alphabet.length) : 0),
  };
}

export const apikeyGenerator: Generator = {
  name: 'apikey',
  summary: 'API key with a prefix and optional checksum (sk_live_...)',
  usage: 'apikey [--prefix sk_live_] [--length 32] [--checksum]',
  details: [
    'The body is drawn from a 62-symbol URL-safe alphabet.',
    '--checksum appends a 6-character Crockford base32 digest of the key, which catches',
    'typos and truncated keys before they ever hit your server.',
  ],
  examples: ['mint apikey', 'mint apikey --prefix pk_test_ --length 24', 'mint apikey --checksum'],
  flags: ['length', 'size', 'bytes', 'bits', 'prefix', 'checksum', 'exclude', 'alphabet'],
  run(context) {
    const flags = context.flags;
    const prefix = flags.getString('prefix') ?? 'sk_live_';
    const alphabet = flags.getString('alphabet') ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const request = readSize(flags);
    const wanted = requestedBits(request);
    const length = wanted !== undefined ? charsForEntropy(wanted, alphabet.length) : (request.chars ?? 32);
    if (length < 8) throw new UsageError('--length must be at least 8 for an API key');

    const body = sampleChars(length, alphabet);
    let value = prefix + body;
    const fields: Record<string, string | number> = { prefix, length: body.length, charsetSize: alphabet.length };

    if (flags.getBool('checksum')) {
      const checksum = encodeCrockford(createHash('sha256').update(value).digest()).slice(0, 6);
      value += `_${checksum}`;
      fields.checksum = checksum;
    }

    return { value, fields, entropyBits: alphabetEntropyBits(length, alphabet.length) };
  },
};

export const webhookSecretGenerator: Generator = {
  name: 'webhook-secret',
  summary: 'Webhook signing secret (whsec_...)',
  usage: 'webhook-secret [--bytes 32]',
  details: ['--prefix overrides the whsec_ prefix (it is part of the secret, not of the output).'],
  examples: ['mint webhook-secret', 'mint webhook-secret --bytes 16'],
  flags: [...BYTE_SECRET_FLAGS, 'prefix'],
  run(context) {
    const prefix = context.flags.getString('prefix') ?? 'whsec_';
    const result = byteSecret(context, { defaultBytes: 32, format: 'base64' });
    return { ...result, value: prefix + result.value, fields: { ...result.fields, prefix } };
  },
};
