import { DEMO_WORDLIST } from "./wordlist";

export const CHARSET_PRESETS = {
  alnum: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  alpha: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  hex: "0123456789abcdef",
  safe: "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  "url-safe": "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_",
  symbols: "!@#$%^&*()-_=+[]{}|;:,.<>?/~",
} as const;

export type CharsetPreset = keyof typeof CHARSET_PRESETS;

export const GENERATORS = [
  { id: "hex", label: "Hex", category: "Bytes", sizeMode: "bytes" },
  { id: "base64url", label: "Base64 URL", category: "Bytes", sizeMode: "bytes" },
  { id: "chars", label: "Characters", category: "Characters", sizeMode: "chars" },
  { id: "password", label: "Password", category: "Characters", sizeMode: "chars" },
  { id: "passphrase", label: "Passphrase", category: "Characters", sizeMode: "words" },
  { id: "uuid-v4", label: "UUID v4", category: "Identifiers", sizeMode: "none" },
  { id: "uuid-v7", label: "UUID v7", category: "Identifiers", sizeMode: "none" },
  { id: "ulid", label: "ULID", category: "Identifiers", sizeMode: "none" },
  { id: "nanoid", label: "Nano ID", category: "Identifiers", sizeMode: "chars" },
  { id: "apikey", label: "API key", category: "Developer keys", sizeMode: "chars" },
  { id: "jwt-secret", label: "JWT secret", category: "Developer keys", sizeMode: "jwt" },
  { id: "pin", label: "PIN", category: "Characters", sizeMode: "chars" },
  { id: "dice", label: "Dice", category: "Fun", sizeMode: "dice" },
] as const;

export type GeneratorId = (typeof GENERATORS)[number]["id"];
export type SizeMode = (typeof GENERATORS)[number]["sizeMode"];
export type JwtAlgorithm = "hs256" | "hs384" | "hs512";

export interface MintOptions {
  generator: GeneratorId;
  count: number;
  size: number;
  mode: "bytes" | "chars";
  charset: CharsetPreset | "custom";
  customCharset: string;
  avoidAmbiguous: boolean;
  words: number;
  separator: string;
  prefix: string;
  jwtAlgorithm: JwtAlgorithm;
  diceNotation: string;
}

export interface MintResult {
  values: string[];
  entropyBits: number;
  command: string;
  note: string;
}

export const DEFAULT_OPTIONS: MintOptions = {
  generator: "hex",
  count: 1,
  size: 32,
  mode: "bytes",
  charset: "safe",
  customCharset: "abcdef123456",
  avoidAmbiguous: true,
  words: 6,
  separator: "-",
  prefix: "sk_live_",
  jwtAlgorithm: "hs256",
  diceNotation: "2d6+3",
};

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const HEX = "0123456789abcdef";
const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const URL_SAFE = BASE64URL;
const ALNUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}|;:,.<>?/~";
const AMBIGUOUS = new Set(["0", "O", "o", "1", "l", "I", "i"]);
const MAX_RANDOM_BYTES = 4096;
const MAX_RESULTS = 20;

function assertInteger(value: number, min: number, max: number, label: string): number {
  const rounded = Math.floor(value);
  if (!Number.isFinite(value) || rounded < min || rounded > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return rounded;
}

export function secureRandomBytes(size: number): Uint8Array {
  if (!Number.isInteger(size) || size < 1 || size > MAX_RANDOM_BYTES) {
    throw new Error(`Invalid random byte count: ${size}.`);
  }
  const bytes = new Uint8Array(size);
  for (let offset = 0; offset < size; offset += 65536) {
    crypto.getRandomValues(bytes.subarray(offset, Math.min(size, offset + 65536)));
  }
  return bytes;
}

function secureRandomUint32(): number {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
}

export function randomIntBelow(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 2 ** 32) {
    throw new Error(`Invalid random range: ${maxExclusive}.`);
  }
  if (maxExclusive === 1) return 0;
  const limit = 2 ** 32 - (2 ** 32 % maxExclusive);
  for (;;) {
    const value = secureRandomUint32();
    if (value < limit) return value % maxExclusive;
  }
}

export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = randomIntBelow(index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function sampleChars(count: number, charset: string): string {
  const unique = [...new Set([...charset])].join("");
  if (unique.length < 2) throw new Error("A charset needs at least two distinct characters.");
  if (unique.length > 256) throw new Error("A charset can contain at most 256 distinct characters.");
  if (!Number.isInteger(count) || count < 1 || count > MAX_RANDOM_BYTES) {
    throw new Error(`Length must be between 1 and ${MAX_RANDOM_BYTES}.`);
  }
  const limit = 256 - (256 % unique.length);
  const output: string[] = [];
  while (output.length < count) {
    const batch = secureRandomBytes(Math.min(MAX_RANDOM_BYTES, Math.max(32, Math.ceil((count - output.length) * 1.4))));
    for (const byte of batch) {
      if (byte >= limit) continue;
      output.push(unique[byte % unique.length]);
      if (output.length === count) break;
    }
  }
  return output.join("");
}

function encodeBase64Url(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const chunk = (first << 16) | (second << 8) | third;
    output += BASE64URL[(chunk >> 18) & 63];
    output += BASE64URL[(chunk >> 12) & 63];
    if (index + 1 < bytes.length) output += BASE64URL[(chunk >> 6) & 63];
    if (index + 2 < bytes.length) output += BASE64URL[chunk & 63];
  }
  return output;
}

function encodeBase32(bytes: Uint8Array, alphabet: string): string {
  let output = "";
  let accumulator = 0;
  let bits = 0;
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += alphabet[(accumulator >>> bits) & 31];
    }
  }
  if (bits > 0) output += alphabet[(accumulator << (5 - bits)) & 31];
  return output;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatUuid(bytes: Uint8Array): string {
  const hex = toHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function uuidV4(): string {
  const bytes = secureRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuid(bytes);
}

function uuidV7(): string {
  const bytes = secureRandomBytes(16);
  const timestamp = BigInt(Date.now());
  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuid(bytes);
}

function ulid(): string {
  let timestamp = BigInt(Date.now());
  const timePart = new Array<string>(10);
  for (let index = 9; index >= 0; index -= 1) {
    timePart[index] = CROCKFORD[Number(timestamp & 31n)];
    timestamp >>= 5n;
  }
  return timePart.join("") + encodeBase32(secureRandomBytes(10), CROCKFORD);
}

function password(length: number, avoidAmbiguous: boolean): string {
  let alphabet = ALNUM + SYMBOLS;
  if (avoidAmbiguous) alphabet = [...alphabet].filter((char) => !AMBIGUOUS.has(char)).join("");
  const classes = [
    "abcdefghijklmnopqrstuvwxyz",
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "0123456789",
    SYMBOLS,
  ]
    .map((group) => [...group].filter((char) => alphabet.includes(char)).join(""))
    .filter(Boolean);

  if (length < classes.length) throw new Error(`Length must be at least ${classes.length} for a password.`);
  const required = classes.map((group) => sampleChars(1, group));
  const rest = sampleChars(length - required.length, alphabet);
  return shuffle([...required, ...rest]).join("");
}

function passphrase(words: number, separator: string): string {
  const output: string[] = [];
  for (let index = 0; index < words; index += 1) {
    output.push(DEMO_WORDLIST[randomIntBelow(DEMO_WORDLIST.length)]);
  }
  return output.join(separator);
}

function nanoid(length: number): string {
  return sampleChars(length, URL_SAFE);
}

function apiKey(prefix: string, length: number): string {
  const safePrefix = prefix.replace(/[^A-Za-z0-9_-]/g, "");
  return `${safePrefix}${sampleChars(length, ALNUM)}`;
}

function jwtSecret(algorithm: JwtAlgorithm): { value: string; bytes: number } {
  const bytes = algorithm === "hs512" ? 64 : algorithm === "hs384" ? 48 : 32;
  return { value: encodeBase64Url(secureRandomBytes(bytes)), bytes };
}

function pin(length: number): string {
  return sampleChars(length, "0123456789");
}

function parseDice(notation: string): { count: number; sides: number; modifier: number } {
  const match = /^(?:(\d+)?d(\d+))([+-]\d+)?$/i.exec(notation.trim());
  if (!match) throw new Error("Dice notation must look like d20, 2d6 or 4d6+2.");
  const count = match[1] ? Number(match[1]) : 1;
  const sides = Number(match[2]);
  const modifier = match[3] ? Number(match[3]) : 0;
  if (count < 1 || count > 100) throw new Error("Dice count must be between 1 and 100.");
  if (sides < 2 || sides > 1_000_000) throw new Error("A die needs between 2 and 1,000,000 sides.");
  return { count, sides, modifier };
}

function rollDice(notation: string): { value: string; entropyBits: number } {
  const { count, sides, modifier } = parseDice(notation);
  let total = modifier;
  for (let index = 0; index < count; index += 1) total += randomIntBelow(sides) + 1;
  return { value: String(total), entropyBits: count * Math.log2(sides) };
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function generate(options: MintOptions): MintResult {
  const count = assertInteger(options.count, 1, MAX_RESULTS, "Count");
  const size = assertInteger(options.size, 1, 4096, "Size");
  const words = assertInteger(options.words, 2, 24, "Words");
  const values: string[] = [];
  let entropyBits = 0;
  let command = "";
  let note = "";

  switch (options.generator) {
    case "hex": {
      for (let index = 0; index < count; index += 1) {
        values.push(options.mode === "bytes" ? toHex(secureRandomBytes(size)) : sampleChars(size, HEX));
      }
      entropyBits = options.mode === "bytes" ? size * 8 : size * 4;
      command = `mint hex --${options.mode === "bytes" ? "bytes" : "length"} ${size} --count ${count}`;
      note = options.mode === "bytes" ? `${size} bytes encoded as hex` : `${size} hex characters sampled uniformly`;
      break;
    }
    case "base64url": {
      for (let index = 0; index < count; index += 1) {
        values.push(options.mode === "bytes" ? encodeBase64Url(secureRandomBytes(size)) : sampleChars(size, BASE64URL));
      }
      entropyBits = options.mode === "bytes" ? size * 8 : size * 6;
      command = `mint base64url --${options.mode === "bytes" ? "bytes" : "length"} ${size} --count ${count}`;
      note = options.mode === "bytes" ? `${size} bytes encoded without padding` : `${size} URL-safe characters`;
      break;
    }
    case "chars": {
      const charset =
        options.charset === "custom"
          ? [...new Set([...options.customCharset])].join("")
          : CHARSET_PRESETS[options.charset];
      if (charset.length < 2) throw new Error("A custom charset needs at least two distinct characters.");
      for (let index = 0; index < count; index += 1) values.push(sampleChars(size, charset));
      entropyBits = size * Math.log2(charset.length);
      command =
        options.charset === "custom"
          ? `mint chars --charset ${shellQuote(charset)} --length ${size} --count ${count}`
          : `mint chars --charset ${options.charset} --length ${size} --count ${count}`;
      note = `${charset.length}-symbol charset, rejection sampled`;
      break;
    }
    case "password": {
      if (size < 4) throw new Error("Length must be at least 4 for a password.");
      for (let index = 0; index < count; index += 1) values.push(password(size, options.avoidAmbiguous));
      const alphabet = options.avoidAmbiguous
        ? [...ALNUM + SYMBOLS].filter((char) => !AMBIGUOUS.has(char)).length
        : (ALNUM + SYMBOLS).length;
      entropyBits = size * Math.log2(alphabet);
      command = `mint password --length ${size}${options.avoidAmbiguous ? " --no-ambiguous" : ""} --count ${count}`;
      note = "lowercase, uppercase, digit and symbol guaranteed";
      break;
    }
    case "passphrase": {
      for (let index = 0; index < count; index += 1) values.push(passphrase(words, options.separator));
      entropyBits = words * Math.log2(DEMO_WORDLIST.length);
      const separator = shellQuote(options.separator);
      command = `mint passphrase --words ${words}${options.separator === "-" ? "" : ` --separator ${separator}`} --count ${count}`;
      note = "demo uses a 64-word list; the CLI uses 2048 words (11 bits each)";
      break;
    }
    case "uuid-v4": {
      for (let index = 0; index < count; index += 1) values.push(uuidV4());
      entropyBits = 122;
      command = `mint uuid --count ${count}`;
      note = "RFC 9562 version 4, 122 random bits";
      break;
    }
    case "uuid-v7": {
      for (let index = 0; index < count; index += 1) values.push(uuidV7());
      entropyBits = 74;
      command = `mint uuid --v7 --count ${count}`;
      note = "48-bit timestamp plus 74 random bits";
      break;
    }
    case "ulid": {
      for (let index = 0; index < count; index += 1) values.push(ulid());
      entropyBits = 80;
      command = `mint ulid --count ${count}`;
      note = "48-bit timestamp plus 80 random bits";
      break;
    }
    case "nanoid": {
      for (let index = 0; index < count; index += 1) values.push(nanoid(size));
      entropyBits = size * 6;
      command = `mint nanoid --size ${size} --count ${count}`;
      note = "64-symbol URL-safe alphabet";
      break;
    }
    case "apikey": {
      for (let index = 0; index < count; index += 1) values.push(apiKey(options.prefix, size));
      entropyBits = size * Math.log2(ALNUM.length);
      command = `mint apikey --prefix ${shellQuote(options.prefix)} --length ${size} --count ${count}`;
      note = "alphanumeric body with your prefix";
      break;
    }
    case "jwt-secret": {
      const bytes = options.jwtAlgorithm === "hs512" ? 64 : options.jwtAlgorithm === "hs384" ? 48 : 32;
      for (let index = 0; index < count; index += 1) values.push(jwtSecret(options.jwtAlgorithm).value);
      entropyBits = bytes * 8;
      command = `mint jwt-secret --algo ${options.jwtAlgorithm} --count ${count}`;
      note = `${bytes} bytes, base64url encoded for ${options.jwtAlgorithm.toUpperCase()}`;
      break;
    }
    case "pin": {
      for (let index = 0; index < count; index += 1) values.push(pin(size));
      entropyBits = size * Math.log2(10);
      command = `mint pin --length ${size} --count ${count}`;
      note = "each digit sampled uniformly, leading zero allowed";
      break;
    }
    case "dice": {
      for (let index = 0; index < count; index += 1) {
        const result = rollDice(options.diceNotation);
        values.push(result.value);
        entropyBits = result.entropyBits;
      }
      command = `mint dice ${shellQuote(options.diceNotation)} --count ${count}`;
      note = "each die is an independent, bias-free draw";
      break;
    }
    default: {
      const exhaustive: never = options.generator;
      throw new Error(`Unknown generator: ${String(exhaustive)}`);
    }
  }

  return { values, entropyBits, command, note };
}
