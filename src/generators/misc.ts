import { RuntimeError, UsageError } from '../errors.js';
import {
  randomBigIntBelow,
  randomBigIntInRange,
  randomBytes,
  randomInRange,
  randomIntBelow,
  sampleMany,
  sampleOne,
  shuffle,
} from '../random.js';
import { readSize } from '../size.js';
import type { GenContext, GenResult, Generator } from '../types.js';

function hexPair(value: number): string {
  return value.toString(16).padStart(2, '0');
}

function hslFromRgb(red: number, green: number, blue: number): [number, number, number] {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return [0, 0, Math.round(lightness * 100)];

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  return [Math.round(((hue * 60) % 360 + 360) % 360), Math.round(saturation * 100), Math.round(lightness * 100)];
}

function isPublicIPv4(bytes: Buffer): boolean {
  const [a, b, c] = [bytes[0], bytes[1], bytes[2]];
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function compressIPv6(groups: string[]): string {
  let bestStart = -1;
  let bestLength = 0;
  let start = -1;
  for (let index = 0; index <= groups.length; index++) {
    if (index < groups.length && groups[index] === '0') {
      if (start === -1) start = index;
    } else if (start !== -1) {
      const length = index - start;
      if (length > bestLength) {
        bestLength = length;
        bestStart = start;
      }
      start = -1;
    }
  }
  if (bestLength < 2) return groups.join(':');
  const head = groups.slice(0, bestStart).join(':');
  const tail = groups.slice(bestStart + bestLength).join(':');
  if (head === '' && tail === '') return '::';
  if (head === '') return `::${tail}`;
  if (tail === '') return `${head}::`;
  return `${head}::${tail}`;
}

function repeatCount(context: GenContext): number {
  return context.flags.getInt('count', { min: 1, max: 10_000 }) ?? 1;
}

export const colorGenerator: Generator = {
  name: 'color',
  summary: 'Random color (hex, rgb or hsl)',
  usage: 'color [--format hex|rgb|hsl]',
  examples: ['mint color', 'mint color --format rgb', 'mint color --format hsl --count 5'],
  flags: ['format'],
  run(context) {
    const format = context.flags.getEnum('format', ['hex', 'rgb', 'hsl'] as const) ?? 'hex';
    const bytes = randomBytes(3);
    const [red, green, blue] = [bytes[0], bytes[1], bytes[2]];
    let value: string;
    if (format === 'rgb') value = `rgb(${red}, ${green}, ${blue})`;
    else if (format === 'hsl') {
      const [hue, saturation, lightness] = hslFromRgb(red, green, blue);
      value = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    } else value = `#${hexPair(red)}${hexPair(green)}${hexPair(blue)}`;
    return { value, fields: { format, red, green, blue }, entropyBits: 24 };
  },
};

export const macGenerator: Generator = {
  name: 'mac',
  summary: 'Random locally-administered MAC address',
  usage: 'mac [--separator :] [--upper]',
  examples: ['mint mac', 'mint mac --separator - --upper'],
  flags: ['separator', 'upper', 'lower'],
  run(context) {
    const bytes = randomBytes(6);
    bytes[0] = (bytes[0] | 0x02) & 0xfe; // locally administered, unicast
    const upper = context.flags.getBool('upper');
    const separator = context.flags.getString('separator') ?? ':';
    let value = [...bytes].map((byte) => hexPair(byte)).join(separator);
    if (upper) value = value.toUpperCase();
    return { value, fields: { separator, bytes: 6 }, entropyBits: 46 };
  },
};

export const ipv4Generator: Generator = {
  name: 'ipv4',
  summary: 'Random IPv4 address',
  usage: 'ipv4 [--public]',
  details: ['--public rejects loopback, private, link-local, CGNAT, multicast and reserved ranges.'],
  examples: ['mint ipv4', 'mint ipv4 --public', 'mint ipv4 --count 4'],
  flags: ['public'],
  run(context) {
    const onlyPublic = context.flags.getBool('public');
    for (let attempt = 0; attempt < 10_000; attempt++) {
      const bytes = randomBytes(4);
      if (!onlyPublic || isPublicIPv4(bytes)) {
        const value = `${bytes[0]}.${bytes[1]}.${bytes[2]}.${bytes[3]}`;
        return { value, fields: { public: onlyPublic }, entropyBits: onlyPublic ? 31 : 32 };
      }
    }
    throw new RuntimeError('could not find a public IPv4 address after 10000 attempts');
  },
};

export const ipv6Generator: Generator = {
  name: 'ipv6',
  summary: 'Random IPv6 address',
  usage: 'ipv6 [--compressed] [--upper]',
  examples: ['mint ipv6', 'mint ipv6 --compressed'],
  flags: ['compressed', 'upper', 'lower'],
  run(context) {
    const bytes = randomBytes(16);
    const groups: string[] = [];
    for (let index = 0; index < 16; index += 2) groups.push(bytes.readUInt16BE(index).toString(16));
    const upper = context.flags.getBool('upper');
    const compress = context.flags.getBool('compressed');
    const value = compress
      ? compressIPv6(groups)
      : groups.map((group) => group.padStart(4, '0')).join(':');
    return {
      value: upper ? value.toUpperCase() : value,
      fields: { compressed: compress },
      entropyBits: 128,
    };
  },
};

export const portGenerator: Generator = {
  name: 'port',
  summary: 'Random TCP/UDP port number',
  usage: 'port [--min 1] [--max 65535]',
  examples: ['mint port', 'mint port --min 1024', 'mint port --min 8000 --max 8999'],
  flags: ['min', 'max'],
  run(context) {
    const min = context.flags.getInt('min', { min: 0, max: 65535 }) ?? 1;
    const max = context.flags.getInt('max', { min: 0, max: 65535 }) ?? 65535;
    const value = randomInRange(min, max);
    return { value: String(value), fields: { min, max }, entropyBits: Math.log2(max - min + 1) };
  },
};

export const diceGenerator: Generator = {
  name: 'dice',
  summary: 'Roll dice, e.g. 2d6, d20, 4d6+2',
  usage: 'dice [2d6] [--count 1]',
  details: [
    'Accepts NdM notation with an optional modifier: d20, 2d6, 4d6+2, 3d8-1.',
    'Every die is drawn independently with rejection sampling, so no modulo bias.',
  ],
  examples: ['mint dice', 'mint dice 2d6', 'mint dice 4d6+2', 'mint dice d20 --count 5'],
  flags: [],
  acceptsPositionals: true,
  run(context) {
    const spec = context.positionals[0] ?? '1d6';
    const match = /^(?:(\d+)?d(\d+))([+-]\d+)?$/iu.exec(spec);
    if (!match) {
      throw new UsageError(
        `cannot parse dice "${spec}"`,
        'use NdM notation such as d20, 2d6, 4d6+2 or 3d8-1',
      );
    }
    const diceCount = match[1] ? Number(match[1]) : 1;
    const sides = Number(match[2]);
    const modifier = match[3] ? Number(match[3]) : 0;
    if (diceCount < 1 || diceCount > 1000) throw new UsageError(`dice count must be between 1 and 1000, got ${diceCount}`);
    if (sides < 2 || sides > 1_000_000) throw new UsageError(`a die needs between 2 and 1000000 sides, got ${sides}`);

    const rolls: number[] = [];
    for (let index = 0; index < diceCount; index++) rolls.push(randomIntBelow(sides) + 1);
    const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier;
    return {
      value: String(total),
      fields: { notation: spec, rolls: rolls.join(' '), modifier, total },
      entropyBits: diceCount * Math.log2(sides),
    };
  },
};

export const coinGenerator: Generator = {
  name: 'coin',
  summary: 'Coin flip (heads or tails)',
  usage: 'coin [--count 1]',
  examples: ['mint coin', 'mint coin --count 5'],
  flags: [],
  run() {
    return { value: randomIntBelow(2) === 0 ? 'heads' : 'tails', entropyBits: 1 };
  },
};

export const intGenerator: Generator = {
  name: 'int',
  summary: 'Random integer in a range, bias-free',
  usage: 'int [--min 0] [--max 4294967295]',
  details: [
    'Values are drawn with rejection sampling over the exact range, so every integer in',
    'the interval is equally likely - including ranges that are not a power of two.',
    '--bytes/--bits draw an integer up to that many bits wide instead.',
  ],
  examples: ['mint int', 'mint int --min 1 --max 100', 'mint int --min -50 --max 50', 'mint int --bits 128'],
  flags: ['min', 'max', 'bytes', 'bits'],
  run(context): GenResult {
    const flags = context.flags;
    const request = readSize(flags);
    const wanted = request.mode === 'bytes' ? request.bytes! * 8 : request.mode === 'bits' ? request.bits! : undefined;

    if (wanted !== undefined) {
      if (flags.has('min') || flags.has('max')) {
        throw new UsageError('use either --min/--max or --bytes/--bits, not both');
      }
      const upper = 1n << BigInt(wanted);
      const value = randomBigIntBelow(upper);
      return { value: value.toString(), fields: { bits: wanted }, entropyBits: wanted };
    }

    const minRaw = flags.getString('min') ?? '0';
    const maxRaw = flags.getString('max') ?? '4294967295';
    if (!/^-?\d+$/u.test(minRaw)) throw new UsageError(`--min expects an integer, got "${minRaw}"`);
    if (!/^-?\d+$/u.test(maxRaw)) throw new UsageError(`--max expects an integer, got "${maxRaw}"`);
    const min = BigInt(minRaw);
    const max = BigInt(maxRaw);
    if (max < min) throw new UsageError(`--max (${max}) must be greater than or equal to --min (${min})`);

    const value = randomBigIntInRange(min, max);
    return {
      value: value.toString(),
      fields: { min: min.toString(), max: max.toString() },
      entropyBits: Math.log2(Number(max - min + 1n)),
    };
  },
};

function listItems(context: GenContext, command: string): string[] {
  if (context.positionals.length > 0) return context.positionals;
  const piped = context.readStdin?.() ?? [];
  if (piped.length > 0) return piped;
  throw new UsageError(
    `mint ${command} needs at least one item`,
    `example: mint ${command} red green blue   (or pipe a list: ls | mint ${command})`,
  );
}

export const pickGenerator: Generator = {
  name: 'pick',
  summary: 'Pick a random item from the arguments or from stdin',
  usage: 'pick <item...> [--count 1] [--unique]',
  details: ['With no arguments the items are read from stdin, one per line: `ls | mint pick`.'],
  examples: ['mint pick red green blue', 'ls | mint pick', 'mint pick a b c d --count 2 --unique'],
  flags: ['unique'],
  usesCount: true,
  acceptsPositionals: true,
  run(context) {
    const items = listItems(context, 'pick');
    const count = repeatCount(context);
    if (context.flags.getBool('unique')) {
      const picked = sampleMany(items, count);
      return { value: picked.join('\n'), fields: { picks: picked.length, unique: true }, entropyBits: Math.log2(items.length) * count };
    }
    const picked: string[] = [];
    for (let index = 0; index < count; index++) picked.push(sampleOne(items));
    return { value: picked.join('\n'), fields: { picks: count, unique: false }, entropyBits: Math.log2(items.length) * count };
  },
};

export const shuffleGenerator: Generator = {
  name: 'shuffle',
  summary: 'Shuffle the arguments (or stdin lines) into a random order',
  usage: 'shuffle <item...> [--count 1]',
  details: ['With no arguments the items are read from stdin, one per line: `ls | mint shuffle`.'],
  examples: ['mint shuffle a b c d', 'ls | mint shuffle', 'mint shuffle one two three --count 3'],
  flags: [],
  usesCount: true,
  acceptsPositionals: true,
  run(context) {
    const items = listItems(context, 'shuffle');
    const count = repeatCount(context);
    const results: string[] = [];
    for (let index = 0; index < count; index++) results.push(shuffle(items).join('\n'));
    return {
      value: results.join('\n'),
      fields: { items: items.length, shuffles: count },
      entropyBits: factorialBits(items.length) * count,
    };
  },
};

function factorialBits(count: number): number {
  let total = 0;
  for (let index = 2; index <= count; index++) total += Math.log2(index);
  return total;
}
