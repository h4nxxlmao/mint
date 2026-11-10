import type { Palette } from './colors.js';
import { BASE58_ALPHABET, CROCKFORD_ALPHABET, decodeBase32, decodeBase58 } from './encodings.js';
import { UsageError } from './errors.js';
import { ENTROPY_RULE, RULES } from './guard/rules.js';
import { Scanner, fileMarkers } from './guard/scan.js';
import { shannonEntropy } from './guard/entropy.js';
import { readStdinText } from './stdin.js';
import type { Finding } from './guard/types.js';

/**
 * `mint inspect`: the inverse of the generators. Identify a value - which formats it
 * satisfies, how much entropy it carries, and whether it looks like a leaked secret -
 * without ever echoing the value itself.
 */

export interface FormatMatch {
  format: string;
  detail: string;
  /** A shape guess rather than a real validator (does not count as "recognized"). */
  weak?: boolean;
}

export interface Inspection {
  length: number;
  entropyPerCharacter: number;
  charset: string;
  matches: FormatMatch[];
  findings: Finding[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-([1-8])[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const UUID_COMPACT = /^[0-9a-f]{12}([1-8])[0-9a-f]{3}[89ab][0-9a-f]{15}$/iu;
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/u;
const KSUID = /^[0-9A-Za-z]{27}$/u;
const OBJECT_ID = /^[0-9a-f]{24}$/iu;
const TYPE_ID = /^([a-z][a-z0-9]*)_([0-9a-hjkmnp-tv-z]{26})$/u;
const SNOWFLAKE = /^\d{17,19}$/u;
const JWT = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/u;
const PEM = /^-----BEGIN ([A-Z0-9 ]+)-----/u;
const HEX = /^[0-9a-f]+$/iu;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/u;
const BASE32_TEXT = /^[A-Z2-7]+=*$/u;

const KSUID_EPOCH_SECONDS = 1400000000;
const SNOWFLAKE_EPOCH_MS = 1420070400000n;
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const CROCKFORD_INDEX = new Map([...CROCKFORD_ALPHABET].map((char, index) => [char, index]));

function decodeCrockford(text: string): bigint {
  let value = 0n;
  for (const char of text.toUpperCase()) {
    const index = CROCKFORD_INDEX.get(char);
    if (index === undefined) throw new UsageError(`"${char}" is not a Crockford character`);
    value = value * 32n + BigInt(index);
  }
  return value;
}

/** KSUIDs are base62 (0-9A-Za-z), zero-padded to 27 characters. */
function decodeBase62(text: string): Buffer {
  let value = 0n;
  for (const char of text) {
    const index = BASE62.indexOf(char);
    if (index === -1) throw new UsageError(`"${char}" is not a base62 character`);
    value = value * 62n + BigInt(index);
  }
  return Buffer.from(value.toString(16).padStart(40, '0'), 'hex');
}

function isoDate(milliseconds: number): string {
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? 'invalid date' : date.toISOString().replace(/\.\d{3}Z$/u, 'Z');
}

function bytesOfBase64(text: string): number | undefined {
  const clean = text.replace(/=+$/u, '');
  if (clean.length === 0 || clean.length % 4 === 1) return undefined;
  const normalized = clean.replace(/-/gu, '+').replace(/_/gu, '/');
  if (!/^[A-Za-z0-9+/]+$/u.test(normalized)) return undefined;
  return Buffer.from(normalized, 'base64').length;
}

function describeCharset(value: string): string {
  const lower = /[a-z]/u.test(value);
  const upper = /[A-Z]/u.test(value);
  const digits = /\d/u.test(value);
  const symbols = /[^A-Za-z0-9]/u.test(value);
  if (!symbols) {
    if (lower && upper && digits) return 'alphanumeric';
    if (lower && upper) return 'letters';
    if (digits && !lower && !upper) return 'digits';
    if (lower && digits) return 'lowercase + digits';
    if (upper && digits) return 'uppercase + digits';
    return lower ? 'lowercase' : 'uppercase';
  }
  return 'alphanumeric + symbols';
}

export function inspectValue(value: string): Inspection {
  const text = value.trim();
  const matches: FormatMatch[] = [];
  /** Structured formats (uuid, ulid, jwt, ...) win over generic encodings. */
  let structured = false;

  const uuid = UUID.exec(text);
  if (uuid) {
    matches.push({ format: 'uuid', detail: `version ${uuid[1]}` });
    structured = true;
  } else {
    const compact = UUID_COMPACT.exec(text);
    if (compact) {
      matches.push({ format: 'uuid', detail: `version ${compact[1]}, no dashes` });
      structured = true;
    }
  }

  if (ULID.test(text)) {
    const timestamp = Number(decodeCrockford(text.slice(0, 10)));
    matches.push({ format: 'ulid', detail: `timestamp ${isoDate(timestamp)}` });
    structured = true;
  }

  if (TYPE_ID.test(text)) {
    const parts = TYPE_ID.exec(text)!;
    const timestamp = Number(decodeCrockford(parts[2].slice(0, 10)));
    matches.push({ format: 'typeid', detail: `type "${parts[1]}", timestamp ${isoDate(timestamp)}` });
    structured = true;
  }

  if (KSUID.test(text) && text.length === 27) {
    try {
      const bytes = decodeBase62(text);
      if (bytes.length === 20) {
        const seconds = bytes.readUInt32BE(0) + KSUID_EPOCH_SECONDS;
        matches.push({ format: 'ksuid', detail: `timestamp ${isoDate(seconds * 1000)}` });
        structured = true;
      }
    } catch {
      // not base62 after all
    }
  }

  if (OBJECT_ID.test(text) && !UUID.test(text) && !structured) {
    const seconds = Number.parseInt(text.slice(0, 8), 16);
    matches.push({ format: 'objectid', detail: `timestamp ${isoDate(seconds * 1000)}` });
    structured = true;
  }

  if (SNOWFLAKE.test(text)) {
    const milliseconds = (BigInt(text) >> 22n) + SNOWFLAKE_EPOCH_MS;
    matches.push({ format: 'snowflake', detail: `timestamp ${isoDate(Number(milliseconds))}` });
    structured = true;
  }

  if (JWT.test(text)) {
    try {
      const header = JSON.parse(Buffer.from(text.split('.')[0], 'base64url').toString('utf8')) as {
        alg?: string;
        typ?: string;
      };
      matches.push({ format: 'jwt', detail: `alg ${header.alg ?? '?'}${header.typ ? `, typ ${header.typ}` : ''}` });
    } catch {
      matches.push({ format: 'jwt', detail: 'three base64url segments' });
    }
    structured = true;
  }

  const pem = PEM.exec(text);
  if (pem) {
    matches.push({ format: 'pem', detail: pem[1] });
    structured = true;
  }

  if (/^otpauth:\/\/[a-z]+\//u.test(text)) {
    matches.push({ format: 'otpauth', detail: 'provisioning URI' });
    structured = true;
  }

  // Generic encodings only when the value is not already a known structured format.
  // They are checked in order of specificity and only the first hit is reported, so a
  // digest does not also show up as "base58".
  if (!structured) {
    if (HEX.test(text) && text.length % 2 === 0) {
      const bytes = text.length / 2;
      const digest =
        bytes === 16
          ? ' (MD5 length)'
          : bytes === 20
            ? ' (SHA-1 length)'
            : bytes === 32
              ? ' (SHA-256 length)'
              : bytes === 64
                ? ' (SHA-512 length)'
                : '';
      matches.push({ format: 'hex', detail: `${String(bytes)} bytes${digest}` });
    } else if (BASE32_TEXT.test(text) && text.replace(/=+$/u, '').length >= 8) {
      try {
        const bytes = decodeBase32(text).length;
        matches.push({ format: 'base32', detail: `${String(bytes)} bytes` });
      } catch {
        // not valid base32
      }
    } else if (text.length >= 4 && [...text].every((char) => BASE58_ALPHABET.includes(char))) {
      try {
        const bytes = decodeBase58(text).length;
        matches.push({ format: 'base58', detail: `${String(bytes)} bytes` });
      } catch {
        // ignore
      }
    } else if (BASE64.test(text) && text.length >= 8) {
      const bytes = bytesOfBase64(text);
      if (bytes !== undefined) matches.push({ format: 'base64', detail: `${String(bytes)} bytes` });
    } else if (BASE64URL.test(text) && /[-_]/u.test(text)) {
      const bytes = bytesOfBase64(text);
      if (bytes !== undefined) matches.push({ format: 'base64url', detail: `${String(bytes)} bytes` });
    } else if (text.length >= 21 && /^[A-Za-z0-9_-]+$/u.test(text)) {
      matches.push({ format: 'nanoid-like', detail: 'URL-safe alphabet, any length', weak: true });
    }
  }

  const scanner = new Scanner({
    rules: RULES,
    entropyRule: ENTROPY_RULE,
    entropy: { threshold: 4.5, minLength: 20, maxLength: 200 },
    salt: '',
    baselineIds: new Set(),
    inlineComments: false,
    maxFindings: 5,
  });
  scanner.scanContent(text, { file: '<input>', source: 'check' }, fileMarkers(text, RULES));

  return {
    length: text.length,
    entropyPerCharacter: Number(shannonEntropy(text).toFixed(2)),
    charset: describeCharset(text),
    matches,
    findings: scanner.outcome().findings,
  };
}

export function inspectFound(matches: readonly FormatMatch[], findings: readonly Finding[]): boolean {
  return matches.some((match) => match.weak !== true) || findings.length > 0;
}

export function renderInspection(inspection: Inspection, format: 'text' | 'json', palette: Palette): string {
  if (format === 'json') {
    return `${JSON.stringify(
      {
        length: inspection.length,
        entropyPerCharacter: inspection.entropyPerCharacter,
        charset: inspection.charset,
        recognized: inspectFound(inspection.matches, inspection.findings),
        formats: inspection.matches.map((match) => ({ name: match.format, detail: match.detail })),
        secret: {
          detected: inspection.findings.length > 0,
          findings: inspection.findings.map((finding) => ({
            rule: finding.ruleId,
            severity: finding.severity,
            preview: finding.preview,
            mintCommand: finding.mintCommand,
            rotation: finding.rotation,
          })),
        },
      },
      null,
      2,
    )}\n`;
  }

  const lines: string[] = [palette.bold('mint inspect'), ''];
  lines.push(`  ${palette.dim('length   ')}${String(inspection.length)} characters`);
  lines.push(`  ${palette.dim('entropy  ')}${inspection.entropyPerCharacter.toFixed(2)} bits/char`);
  lines.push(`  ${palette.dim('charset  ')}${inspection.charset}`);
  lines.push('');

  if (inspection.matches.length === 0) {
    lines.push(`  ${palette.dim('formats  ')}no known format`);
  } else {
    const width = Math.max(...inspection.matches.map((match) => match.format.length));
    lines.push(`  ${palette.dim('formats')}`);
    for (const match of inspection.matches) {
      lines.push(`    ${palette.cyan(match.format.padEnd(width))}  ${palette.dim(match.detail)}`);
    }
  }
  lines.push('');

  if (inspection.findings.length === 0) {
    lines.push(`  ${palette.green('✓')} no known secret pattern`);
  } else {
    const first = inspection.findings[0];
    lines.push(`  ${palette.red('!')} looks like ${first.ruleName} (${first.ruleId}, ${first.severity})`);
    lines.push(`    ${palette.dim('preview:')} ${first.preview}`);
    lines.push(`    ${palette.dim('triage: ')} mint guard check`);
    lines.push(`    ${palette.dim('rotate: ')} mint guard rotate-help ${first.ruleId}`);
  }

  return `${lines.join('\n')}\n`;
}

export function readInspectInput(positionals: readonly string[]): string {
  const fromArgs = positionals[0];
  if (fromArgs !== undefined) {
    if (fromArgs.trim() === '') throw new UsageError('the value to inspect is empty');
    return fromArgs;
  }
  const piped = readStdinText();
  if (piped === '') {
    throw new UsageError('inspect needs a value', 'mint inspect "<value>" or pipe it: pbpaste | mint inspect');
  }
  return piped;
}
