const CODES = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
  magenta: '\u001b[35m',
} as const;

export interface Palette {
  bold(text: string): string;
  dim(text: string): string;
  red(text: string): string;
  green(text: string): string;
  yellow(text: string): string;
  cyan(text: string): string;
  magenta(text: string): string;
  enabled: boolean;
}

function paint(code: string, enabled: boolean) {
  return (text: string): string => (enabled ? `${code}${text}${CODES.reset}` : text);
}

export function colorsEnabled(stream: { isTTY?: boolean }): boolean {
  const noColor = process.env.NO_COLOR;
  if (noColor !== undefined && noColor !== '') return false;
  const forceColor = process.env.FORCE_COLOR;
  if (forceColor !== undefined && forceColor !== '' && forceColor !== '0') return true;
  if (termIsDumb()) return false;
  return stream.isTTY === true;
}

function termIsDumb(): boolean {
  return process.env.TERM === 'dumb';
}

export function paletteFor(stream: { isTTY?: boolean }): Palette {
  const enabled = colorsEnabled(stream);
  return {
    enabled,
    bold: paint(CODES.bold, enabled),
    dim: paint(CODES.dim, enabled),
    red: paint(CODES.red, enabled),
    green: paint(CODES.green, enabled),
    yellow: paint(CODES.yellow, enabled),
    cyan: paint(CODES.cyan, enabled),
    magenta: paint(CODES.magenta, enabled),
  };
}

export const plainPalette: Palette = paletteFor({ isTTY: false });
