import { UsageError } from './errors.js';

export const LOWER = 'abcdefghijklmnopqrstuvwxyz';
export const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const DIGITS = '0123456789';
export const HEX = '0123456789abcdef';
export const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?/~';
export const URL_SAFE = `${LOWER}${UPPER}${DIGITS}-_`;
export const ALNUM = `${LOWER}${UPPER}${DIGITS}`;
export const AMBIGUOUS = '0Oo1lIi';

export const PRESETS: Readonly<Record<string, string>> = {
  alnum: ALNUM,
  alpha: `${LOWER}${UPPER}`,
  lower: LOWER,
  upper: UPPER,
  digits: DIGITS,
  hex: HEX,
  symbols: SYMBOLS,
  safe: [...ALNUM].filter((char) => !AMBIGUOUS.includes(char)).join(''),
  'url-safe': URL_SAFE,
  urlsafe: URL_SAFE,
  base58: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
};

export const PRESET_NAMES = Object.keys(PRESETS);

export function dedupe(text: string): string {
  return [...new Set([...text])].join('');
}

/**
 * Resolve a `--charset` value into a concrete character list.
 * Known preset names win; anything else is treated as a literal character list.
 */
export function resolveCharset(
  raw: string | undefined,
  options: { exclude?: string | undefined; excludeAmbiguous?: boolean; fallback: string },
): string {
  const source = raw ?? options.fallback;
  const preset = PRESETS[source.toLowerCase()];
  let charset = preset ?? dedupe(source);

  if (options.excludeAmbiguous) {
    charset = [...charset].filter((char) => !AMBIGUOUS.includes(char)).join('');
  }
  if (options.exclude) {
    const banned = new Set([...options.exclude]);
    charset = [...charset].filter((char) => !banned.has(char)).join('');
  }
  if (charset.length < 2) {
    throw new UsageError(
      `charset "${source}" has ${charset.length} usable character(s) after filtering; at least 2 are required`,
      'try --charset alnum, or a longer custom list',
    );
  }
  return charset;
}

/** Split a charset into character classes: lowercase, uppercase, digits, symbols. */
export function classesOf(charset: string): string[][] {
  const lower: string[] = [];
  const upper: string[] = [];
  const digits: string[] = [];
  const symbols: string[] = [];
  for (const char of charset) {
    if (char >= 'a' && char <= 'z') lower.push(char);
    else if (char >= 'A' && char <= 'Z') upper.push(char);
    else if (char >= '0' && char <= '9') digits.push(char);
    else symbols.push(char);
  }
  return [lower, upper, digits, symbols].filter((group) => group.length > 0);
}
