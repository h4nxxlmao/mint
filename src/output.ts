import { copyToClipboard } from './clipboard.js';
import type { GenResult } from './types.js';

export interface OutputOptions {
  generator: string;
  json: boolean;
  newline: boolean;
  copy: boolean;
  entropy: boolean;
  env: string | undefined;
  prefix: string | undefined;
  suffix: string | undefined;
}

export interface RenderedOutput {
  stdout: string;
  stderr: string;
}

export function formatBits(bits: number): string {
  if (!Number.isFinite(bits)) return 'unbounded';
  if (Number.isInteger(bits)) return String(bits);
  return bits.toFixed(1);
}

function decorateLine(line: string, result: GenResult, options: OutputOptions): string {
  const consumesPrefix = result.fields !== undefined && 'prefix' in result.fields;
  const head = consumesPrefix ? '' : (options.prefix ?? '');
  return `${head}${line}${options.suffix ?? ''}`;
}

/**
 * Values that span several lines (pick/shuffle) are decorated line by line, so
 * `--env`, `--prefix` and `--suffix` apply to every generated value instead of
 * only the first/last one.
 */
function decorate(results: readonly GenResult[], options: OutputOptions): { values: string[]; lines: string[] } {
  const values: string[] = [];
  const lines: string[] = [];
  for (const result of results) {
    const decorated = result.value.split('\n').map((line) => decorateLine(line, result, options));
    values.push(decorated.join('\n'));
    lines.push(...decorated);
  }
  return { values, lines };
}

function entropyLine(results: GenResult[]): string | undefined {
  const bits = results.map((result) => result.entropyBits).filter((value): value is number => value !== undefined);
  if (bits.length === 0) return undefined;
  const total = bits.reduce((sum, value) => sum + value, 0);
  if (bits.length === 1) return `entropy: ${formatBits(bits[0])} bits`;
  const sorted = [...new Set(bits.map(formatBits))];
  const each = sorted.length === 1 ? `${sorted[0]} bits each` : `${formatBits(total / bits.length)} bits each`;
  return `entropy: ${each}, ${formatBits(total)} bits total`;
}

export function render(results: GenResult[], options: OutputOptions): RenderedOutput {
  const { values, lines } = decorate(results, options);
  const stderr: string[] = [];

  let body: string;
  if (options.json) {
    const payload = results.map((result, index) => {
      const entry: Record<string, unknown> = { generator: options.generator, value: values[index] };
      if (result.entropyBits !== undefined) entry.entropyBits = Number(formatBits(result.entropyBits));
      if (result.fields) Object.assign(entry, result.fields);
      return entry;
    });
    body = JSON.stringify(results.length === 1 ? payload[0] : payload, null, 2);
  } else if (options.env) {
    const name = options.env;
    body = lines
      .map((line, index) => (lines.length === 1 ? `${name}=${line}` : `${name}_${String(index + 1)}=${line}`))
      .join('\n');
  } else {
    body = lines.join('\n');
  }

  if (options.newline) {
    if (!body.endsWith('\n')) body += '\n';
  } else {
    // Multi-line values (PEM keys) carry their own trailing newline.
    body = body.replace(/\n+$/u, '');
  }

  if (options.entropy) {
    const line = entropyLine(results);
    if (line) stderr.push(line);
  }

  if (options.copy) {
    const copied = copyToClipboard(values.join('\n'));
    if (!copied) {
      stderr.push('warning: could not reach a clipboard helper (tried pbcopy, clip, xclip, wl-copy, xsel)');
    }
  }

  return {
    stdout: body,
    stderr: stderr.length > 0 ? `${stderr.join('\n')}\n` : '',
  };
}
