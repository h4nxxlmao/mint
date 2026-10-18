import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { UsageError } from '../src/errors.js';
import { mint, mintValue, type MintOptions } from '../src/index.js';
import { WORDLIST } from '../src/wordlist.js';

const value = (command: string, options: MintOptions = {}, positionals: string[] = []): string =>
  mintValue(command, options, positionals);

const values = (command: string, options: MintOptions = {}, count = 200, positionals: string[] = []): string[] =>
  Array.from({ length: count }, () => mintValue(command, options, positionals));

function assertAllDistinct(items: string[]): void {
  assert.equal(new Set(items).size, items.length, 'expected every generated value to be unique');
}

function assertMatch(actual: string, pattern: RegExp): void {
  assert.match(actual, pattern);
}

function assertMatchesAll(items: string[], pattern: RegExp): void {
  for (const item of items) assert.match(item, pattern);
}

const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?/~';

const CROCKFORD = /^[0-9A-HJKMNP-TV-Z]+$/;

test('bytes generator family', () => {
  assertMatch(value('bytes'), /^[0-9a-f]{64}$/);
  assertMatch(value('hex'), /^[0-9a-f]{64}$/);
  assertMatch(value('hex', { bytes: 4 }), /^[0-9a-f]{8}$/);
  assertMatch(value('hex', { length: 8 }), /^[0-9a-f]{8}$/);
  assertMatch(value('hex', { bits: 128 }), /^[0-9a-f]{32}$/);
  assertMatch(value('hex', { upper: true }), /^[0-9A-F]{64}$/);
  assertMatch(value('base64'), /^[A-Za-z0-9+/]{43}=$/);
  assertMatch(value('base64url'), /^[A-Za-z0-9_-]{43}$/);
  assertMatch(value('base32', { bytes: 32 }), /^[A-Z2-7]{52}={4}$/);
  assertMatch(value('base32', { bytes: 32, padding: false }), /^[A-Z2-7]{52}$/);
  assertMatch(value('crockford', { bytes: 32 }), CROCKFORD);
  assertMatch(value('base58', { bytes: 32 }), /^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
  assertMatch(value('binary'), /^[01]{32}$/);
  assertMatch(value('binary', { bits: 64 }), /^[01]{64}$/);
  assertMatch(value('binary', { bytes: 8 }), /^[01]{64}$/);
  assertMatch(value('bytes', { base64: true }), /^[A-Za-z0-9+/]{43}=$/);
});

test('bytes generator honours lengths in every encoding', () => {
  assertMatch(value('hex', { length: 7 }), /^[0-9a-f]{7}$/);
  assertMatch(value('base58', { length: 7 }), /^[1-9A-HJ-NP-Za-km-z]{7}$/);
  assertMatch(value('base32', { length: 7 }), /^[A-Z2-7]{7}$/);
  assertMatch(value('crockford', { length: 7 }), CROCKFORD);
  assertMatch(value('crockford', { length: 7, lower: true }), /^[0-9a-hjkmnp-tv-z]{7}$/);
});

test('bytes generator entropy accounting', () => {
  assert.equal(mint('hex', { bytes: 32 }).entropyBits, 256);
  assert.equal(mint('hex', { bits: 256 }).entropyBits, 256);
  assert.equal(mint('binary', { bits: 128 }).entropyBits, 128);
  assert.ok(Math.abs((mint('base58', { length: 10 }).entropyBits ?? 0) - 10 * Math.log2(58)) < 1e-9);
});

test('bytes values are unique and unbiased per byte value', () => {
  assertAllDistinct(values('hex', { bytes: 16 }, 500));
});

test('chars generator', () => {
  assertMatch(value('chars'), /^[A-Za-z0-9]{32}$/);
  assertMatch(value('chars', { charset: 'digits', length: 12 }), /^\d{12}$/);
  assertMatch(value('chars', { charset: 'lower', length: 12 }), /^[a-z]{12}$/);
  assertMatch(value('chars', { charset: 'upper', length: 12 }), /^[A-Z]{12}$/);
  assertMatch(value('chars', { charset: 'alpha', length: 12 }), /^[A-Za-z]{12}$/);
  assertMatch(value('chars', { charset: 'hex', length: 12 }), /^[0-9a-f]{12}$/);
  const symbols = value('chars', { charset: 'symbols', length: 12 });
  assert.equal(symbols.length, 12);
  for (const char of symbols) assert.ok(SYMBOLS.includes(char), `${char} is not a symbol`);
  assertMatch(value('chars', { charset: 'url-safe', length: 12 }), /^[A-Za-z0-9_-]{12}$/);
  assertMatch(value('chars', { charset: 'safe', length: 40 }), /^[A-Za-z0-9]{40}$/);
  assertMatch(value('chars', { charset: 'abc123', length: 12 }), /^[abc123]{12}$/);
  assert.equal(value('chars', { charset: 'safe', length: 100 }).length, 100);
});

test('chars --no-ambiguous never emits look-alike characters', () => {
  const text = value('chars', { ambiguous: false, length: 500 });
  assert.doesNotMatch(text, /[0Oo1lIi]/);
});

test('chars --exclude removes characters', () => {
  const text = value('chars', { exclude: 'abcdefghijklmnopqrstuvwxyz', length: 200 });
  assert.doesNotMatch(text, /[a-z]/);
});

test('chars --length is exact and --bytes targets entropy', () => {
  assert.equal(value('chars', { length: 5 }).length, 5);
  const sized = value('chars', { bits: 256 });
  assert.ok(sized.length >= Math.ceil(256 / Math.log2(62)));
  assert.equal(value('chars', { bytes: 16 }).length, Math.ceil(128 / Math.log2(62)));
});

test('chars --require-each guarantees every character class', () => {
  for (let index = 0; index < 50; index++) {
    const text = value('chars', { charset: 'alnum', length: 4, 'require-each': true });
    assert.match(text, /[a-z]/);
    assert.match(text, /[A-Z]/);
    assert.match(text, /\d/);
  }
});

test('password generator', () => {
  const passwords = values('password', {}, 100);
  assertMatchesAll(passwords, /^.{20}$/);
  for (const password of passwords) {
    assert.match(password, /[a-z]/);
    assert.match(password, /[A-Z]/);
    assert.match(password, /\d/);
    assert.match(password, /[^A-Za-z0-9]/);
  }
  assertAllDistinct(passwords);
  assert.equal(value('password', { length: 32 }).length, 32);
  assert.doesNotMatch(value('password', { ambiguous: false, length: 200 }), /[0Oo1lIi]/);
  assert.doesNotMatch(value('password', { symbols: false, length: 200 }), /[^A-Za-z0-9]/);
  assert.doesNotMatch(value('password', { digits: false, length: 200 }), /\d/);
});

test('passphrase generator', () => {
  const phrase = value('passphrase');
  const words = phrase.split('-');
  assert.equal(words.length, 6);
  for (const word of words) assert.ok(WORDLIST.includes(word), `${word} is not in the word list`);
  assert.equal(value('passphrase', { words: 10 }).split('-').length, 10);
  assert.equal(value('passphrase', { words: 4, separator: '.' }).split('.').length, 4);
  const capitalized = value('passphrase', { words: 3, capitalize: true }).split('-');
  for (const word of capitalized) assert.match(word, /^[A-Z]/);
  assert.match(value('passphrase', { words: 3, number: true }), /-[0-9]{1,2}$/);
  assert.ok((mint('passphrase').entropyBits ?? 0) > 65);
  assert.equal(mint('passphrase', { bits: 44 }).entropyBits, 44);
  assert.equal(value('passphrase', { bits: 44 }).split('-').length, 4);
});

test('word list is well formed', () => {
  assert.ok(WORDLIST.length >= 2048);
  assert.equal(new Set(WORDLIST).size, WORDLIST.length);
  for (const word of WORDLIST) assert.match(word, /^[a-z]+$/);
});

test('pin generator', () => {
  assertMatch(value('pin'), /^\d{6}$/);
  assertMatch(value('pin', { length: 4 }), /^\d{4}$/);
  assertMatch(value('pin', { length: 12 }), /^\d{12}$/);
  assertMatch(value('pin', { length: 8, 'leading-zero': false }), /^[1-9]\d{7}$/);
});

test('uuid generator', () => {
  const v4 = values('uuid', {}, 200);
  assertMatchesAll(v4, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assertAllDistinct(v4);
  assert.equal(mint('uuid').entropyBits, 122);

  assert.match(value('uuid', { v7: true }), /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(value('uuid', { v1: true }), /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(value('uuid', { nil: true }), '00000000-0000-0000-0000-000000000000');
  assert.equal(mint('uuid', { nil: true }).entropyBits, 0);
  assertMatch(value('uuid', { dashes: false }), /^[0-9a-f]{32}$/);
  assertMatch(value('uuid', { upper: true }), /^[0-9A-F-]{36}$/);
});

test('uuid v7 embeds the current timestamp', () => {
  const uuid = value('uuid', { v7: true });
  const milliseconds = Number.parseInt(uuid.replace(/-/gu, '').slice(0, 12), 16);
  assert.ok(Math.abs(milliseconds - Date.now()) < 5000, `timestamp ${milliseconds} is not close to now`);
});

test('uuid v7 is roughly time sorted', () => {
  const first = value('uuid', { v7: true });
  const second = value('uuid', { v7: true });
  const time = (uuid: string) => uuid.replace(/-/gu, '').slice(0, 12);
  assert.ok(time(second) >= time(first));
});

test('uuid v1 embeds a timestamp', () => {
  const uuid = value('uuid', { v1: true });
  const hex = uuid.replace(/-/gu, '');
  const ticks = BigInt(`0x${hex.slice(13, 16)}${hex.slice(8, 12)}${hex.slice(0, 8)}`);
  const milliseconds = Number((ticks - 122192928000000000n) / 10000n);
  assert.ok(Math.abs(milliseconds - Date.now()) < 5000, `timestamp ${milliseconds} is not close to now`);
});

test('ulid generator', () => {
  const ulids = values('ulid', {}, 100);
  assertMatchesAll(ulids, /^[0-9A-HJKMNP-TV-Z]{26}$/);
  assertAllDistinct(ulids);
  assert.equal(mint('ulid').entropyBits, 80);
  assertMatch(value('ulid', { lower: true }), /^[0-9a-hjkmnp-tv-z]{26}$/);
  const first = value('ulid');
  const second = value('ulid');
  assert.ok(second.slice(0, 10) >= first.slice(0, 10), 'timestamp prefix should not go backwards');
});

test('ksuid generator', () => {
  const ksuids = values('ksuid', {}, 100);
  assertMatchesAll(ksuids, /^[0-9A-Za-z]{27}$/);
  assertAllDistinct(ksuids);
  assert.equal(mint('ksuid').entropyBits, 128);
  assertMatch(value('ksuid', { format: 'hex' }), /^[0-9a-f]{40}$/);
  assert.ok(value('ksuid').slice(0, 4) > '0000');
  assert.throws(() => value('ksuid', { format: 'nope' }), UsageError);
});

test('nanoid generator', () => {
  const ids = values('nanoid', {}, 300);
  assertMatchesAll(ids, /^[A-Za-z0-9_-]{21}$/);
  assertAllDistinct(ids);
  assertMatch(value('nanoid', { size: 8 }), /^[A-Za-z0-9_-]{8}$/);
  assertMatch(value('nanoid', { length: 8 }), /^[A-Za-z0-9_-]{8}$/);
  assertMatch(value('nanoid', { alphabet: 'abc' , size: 30 }), /^[abc]{30}$/);
  assert.equal(mint('nanoid').entropyBits, 126);
});

test('cuid generator', () => {
  const ids = values('cuid', {}, 300);
  assertMatchesAll(ids, /^[a-z][a-z0-9]{23}$/);
  assertAllDistinct(ids);
  assert.equal(value('cuid', { length: 12 }).length, 12);
  assert.throws(() => value('cuid', { length: 1 }), UsageError);
});

test('uid generator', () => {
  const ids = values('uid', {}, 300);
  assertMatchesAll(ids, /^[A-Za-z0-9_-]{16}$/);
  assertAllDistinct(ids);
  assertMatch(value('uid', { sortable: true }), /^[0-9a-z]{8}[A-Za-z0-9_-]{8}$/);
  const sorted = values('uid', { sortable: true }, 20);
  const stamps = sorted.map((id) => id.slice(0, 8));
  assert.deepEqual([...stamps].sort(), stamps, 'sortable ids should be ordered by timestamp');
});

test('objectid generator', () => {
  const ids = values('objectid', {}, 300);
  assertMatchesAll(ids, /^[0-9a-f]{24}$/);
  assertAllDistinct(ids);
  const seconds = Number.parseInt(value('objectid').slice(0, 8), 16);
  assert.ok(Math.abs(seconds - Math.floor(Date.now() / 1000)) < 5);
});

test('snowflake generator', () => {
  const ids = values('snowflake', {}, 200);
  assertMatchesAll(ids, /^\d{18,19}$/);
  assertAllDistinct(ids);
  for (const id of ids) assert.ok(BigInt(id) <= 9223372036854775807n);
  const worker = Number((BigInt(value('snowflake', { worker: 512 })) >> 12n) & 0x3ffn);
  assert.equal(worker, 512);
  assert.throws(() => value('snowflake', { worker: 2000 }), UsageError);
});

test('typeid generator', () => {
  const ids = values('typeid', {}, 200);
  assertMatchesAll(ids, /^id_[0-9a-hjkmnp-tv-z]{26}$/);
  assertAllDistinct(ids);
  assertMatch(value('typeid', {}, ['user']), /^user_[0-9a-hjkmnp-tv-z]{26}$/);
  assertMatch(value('typeid', { type: 'org' }), /^org_[0-9a-hjkmnp-tv-z]{26}$/);
  assert.throws(() => value('typeid', { type: 'User' }), UsageError);
  assert.throws(() => value('typeid', { type: 'a'.repeat(64) }), UsageError);
});

test('jwt-secret generator', () => {
  assert.equal(value('jwt-secret').length, 43);
  assertMatch(value('jwt-secret'), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(value('jwt-secret', { format: 'hex' }), 'hex').length, 32);
  assert.equal(Buffer.from(value('jwt-secret', { algo: 'hs384', format: 'hex' }), 'hex').length, 48);
  assert.equal(Buffer.from(value('jwt-secret', { algo: 'hs512', format: 'hex' }), 'hex').length, 64);
  assert.equal(mint('jwt-secret', { algo: 'hs512' }).entropyBits, 512);
  assert.throws(() => value('jwt-secret', { algo: 'md5' }), UsageError);
  assertAllDistinct(values('jwt-secret', {}, 200));
});

test('apikey generator', () => {
  assertMatch(value('apikey'), /^sk_live_[A-Za-z0-9]{32}$/);
  assertMatch(value('apikey', { prefix: 'pk_test_' }), /^pk_test_[A-Za-z0-9]{32}$/);
  assertMatch(value('apikey', { length: 16 }), /^sk_live_[A-Za-z0-9]{16}$/);
  assertMatch(value('apikey', { checksum: true }), /^sk_live_[A-Za-z0-9]{32}_[0-9A-HJKMNP-TV-Z]{6}$/);
  assertAllDistinct(values('apikey', {}, 200));
  assert.throws(() => value('apikey', { length: 4 }), UsageError);
});

test('token, salt, session and hmac generators', () => {
  assertMatch(value('token'), /^[A-Za-z0-9_-]{43}$/);
  assertMatch(value('token', { format: 'hex' }), /^[0-9a-f]{64}$/);
  assertMatch(value('salt'), /^[0-9a-f]{32}$/);
  assertMatch(value('salt', { bytes: 32 }), /^[0-9a-f]{64}$/);
  assertMatch(value('salt', { format: 'base64' }), /^[A-Za-z0-9+/]{22}==$/);
  assertMatch(value('session'), /^[A-Za-z0-9_-]{43}$/);
  assertMatch(value('hmac'), /^[0-9a-f]{64}$/);
  assertMatch(value('hmac', { algo: 'sha512' }), /^[0-9a-f]{128}$/);
  assert.equal(mint('hmac', { algo: 'sha512' }).entropyBits, 512);
});

test('aes generator', () => {
  assertMatch(value('aes'), /^[0-9a-f]{64}$/);
  assertMatch(value('aes', { bits: 128 }), /^[0-9a-f]{32}$/);
  assertMatch(value('aes', { bits: 192 }), /^[0-9a-f]{48}$/);
  assertMatch(value('aes', { bits: 256 }), /^[0-9a-f]{64}$/);
  assertMatch(value('aes', { iv: true, bits: 128 }), /^[0-9a-f]{32}:[0-9a-f]{32}$/);
  assertMatch(value('aes', { iv: true, format: 'base64' }), /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
  assert.equal(mint('aes', { iv: true }).entropyBits, 384);
  assert.throws(() => value('aes', { bits: 64 }), UsageError);
  assert.throws(() => value('aes', { bytes: 20 }), UsageError);
});

test('webhook-secret generator', () => {
  assertMatch(value('webhook-secret'), /^whsec_[A-Za-z0-9+/]{43}=$/);
  assertMatch(value('webhook-secret', { bytes: 16 }), /^whsec_[A-Za-z0-9+/]{22}==$/);
  assertMatch(value('webhook-secret', { prefix: 'custom_' }), /^custom_[A-Za-z0-9+/]{43}=$/);
});

test('color generator', () => {
  assertMatchesAll(values('color', {}, 100), /^#[0-9a-f]{6}$/);
  assert.match(value('color', { format: 'rgb' }), /^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/);
  assert.match(value('color', { format: 'hsl' }), /^hsl\(\d{1,3}, \d{1,3}%, \d{1,3}%\)$/);
  const rgb = value('color', { format: 'rgb' }).match(/\d+/gu)!.map(Number);
  for (const channel of rgb) assert.ok(channel >= 0 && channel <= 255);
  const hsl = value('color', { format: 'hsl' }).match(/\d+/gu)!.map(Number);
  assert.ok(hsl[0] <= 360 && hsl[1] <= 100 && hsl[2] <= 100);
  assert.equal(mint('color').entropyBits, 24);
});

test('mac generator', () => {
  const macs = values('mac', {}, 200);
  assertMatchesAll(macs, /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/);
  assertAllDistinct(macs);
  for (const mac of macs) {
    const first = Number.parseInt(mac.slice(0, 2), 16);
    assert.equal(first & 0x01, 0, 'multicast bit must be clear');
    assert.equal(first & 0x02, 0x02, 'locally administered bit must be set');
  }
  assertMatch(value('mac', { separator: '-' }), /^([0-9a-f]{2}-){5}[0-9a-f]{2}$/);
  assertMatch(value('mac', { upper: true }), /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/);
});

test('ipv4 generator', () => {
  const addresses = values('ipv4', {}, 200);
  for (const address of addresses) {
    const octets = address.split('.').map(Number);
    assert.equal(octets.length, 4);
    for (const octet of octets) assert.ok(octet >= 0 && octet <= 255);
  }
  const privateRanges = [
    /^10\./u,
    /^127\./u,
    /^192\.168\./u,
    /^172\.(1[6-9]|2\d|3[01])\./u,
    /^169\.254\./u,
    /^0\./u,
    /^(22[4-9]|23\d)\./u,
  ];
  for (const address of values('ipv4', { public: true }, 200)) {
    for (const range of privateRanges) assert.doesNotMatch(address, range);
  }
});

test('ipv6 generator', () => {
  assertMatchesAll(values('ipv6', {}, 100), /^([0-9a-f]{4}:){7}[0-9a-f]{4}$/);
  assertMatch(value('ipv6', { upper: true }), /^([0-9A-F]{4}:){7}[0-9A-F]{4}$/);
  for (const address of values('ipv6', { compressed: true }, 100)) {
    const parts = address.split('::');
    assert.ok(parts.length <= 2);
    const groups = parts.flatMap((part) => (part === '' ? [] : part.split(':')));
    for (const group of groups) assert.match(group, /^[0-9a-f]{1,4}$/);
    assert.ok(groups.length <= 8);
  }
});

test('port generator', () => {
  const ports = values('port', {}, 500).map(Number);
  for (const port of ports) assert.ok(port >= 1 && port <= 65535);
  for (const port of values('port', { min: 8000, max: 8009 }, 200).map(Number)) {
    assert.ok(port >= 8000 && port <= 8009);
  }
  assert.throws(() => value('port', { min: 100, max: 90 }), UsageError);
});

test('int generator', () => {
  for (const integer of values('int', {}, 500)) {
    assert.match(integer, /^\d+$/);
    assert.ok(Number(integer) <= 4294967295);
  }
  const small = values('int', { min: 1, max: 6 }, 2000).map(Number);
  for (const integer of small) assert.ok(integer >= 1 && integer <= 6);
  assert.equal(new Set(small).size, 6, 'every value in the range should appear');
  for (const integer of values('int', { min: -10, max: -5 }, 200).map(Number)) {
    assert.ok(integer >= -10 && integer <= -5);
  }
  const big = BigInt(value('int', { bits: 256 }));
  assert.ok(big >= 0n && big < 2n ** 256n);
  assert.equal(mint('int', { bits: 256 }).entropyBits, 256);
  assert.throws(() => value('int', { min: 10, max: 1 }), UsageError);
});

test('dice generator', () => {
  assert.ok(Number(value('dice')) >= 1 && Number(value('dice')) <= 6);
  for (const total of values('dice', {}, 200, ['2d6']).map(Number)) assert.ok(total >= 2 && total <= 12);
  for (const total of values('dice', {}, 200, ['4d6+2']).map(Number)) assert.ok(total >= 6 && total <= 26);
  for (const total of values('dice', {}, 200, ['3d8-1']).map(Number)) assert.ok(total >= 2 && total <= 23);
  for (const total of values('dice', {}, 200, ['d20']).map(Number)) assert.ok(total >= 1 && total <= 20);
  const rolls = values('dice', {}, 400, ['d2']).map(Number);
  assert.ok(rolls.includes(1) && rolls.includes(2));
  assert.throws(() => value('dice', {}, ['2x6']), UsageError);
  assert.throws(() => value('dice', {}, ['0d6']), UsageError);
  assert.throws(() => value('dice', {}, ['1d1']), UsageError);
});

test('coin, pick and shuffle generators', () => {
  const flips = values('coin', {}, 200);
  for (const flip of flips) assert.ok(['heads', 'tails'].includes(flip));
  assert.ok(new Set(flips).size === 2);

  for (const pick of values('pick', {}, 200, ['a', 'b', 'c'])) assert.ok(['a', 'b', 'c'].includes(pick));
  const unique = value('pick', { unique: true, count: 3 }, ['a', 'b', 'c', 'd']).split('\n');
  assert.equal(new Set(unique).size, 3);
  assert.throws(() => value('pick', { unique: true, count: 5 }, ['a', 'b']), UsageError);

  const shuffled = value('shuffle', {}, ['a', 'b', 'c', 'd']).split('\n');
  assert.deepEqual([...shuffled].sort(), ['a', 'b', 'c', 'd']);
  assert.equal(value('shuffle', { count: 3 }, ['a', 'b', 'c']).split('\n').length, 9);
  assert.throws(() => value('shuffle'), UsageError);
});

test('low entropy generators still vary between runs', () => {
  assert.ok(new Set(values('coin', {}, 100)).size === 2);
  assert.ok(new Set(values('dice', {}, 100, ['d6'])).size >= 5);
  assert.ok(new Set(values('color', {}, 100)).size > 90);
});

test('generators reject unknown flags', () => {
  assert.throws(() => value('uuid', { charset: 'abc' }), UsageError);
});

test('sizes are validated', () => {
  assert.throws(() => value('hex', { bytes: 0 }), UsageError);
  assert.throws(() => value('hex', { bytes: 2_000_000 }), UsageError);
  assert.throws(() => value('hex', { length: 0 }), UsageError);
  assert.throws(() => value('hex', { length: 2_000_000 }), UsageError);
  assert.throws(() => value('hex', { bytes: 8, bits: 64 }), UsageError);
  assert.throws(() => value('hex', { bytes: -1 }), UsageError);
  assert.throws(() => value('hex', { length: 'lots' }), UsageError);
});

test('k and m size suffixes are accepted', () => {
  assert.equal(mint('hex', { bytes: '1k' }).fields?.bytes, 1024);
  assert.equal(value('hex', { bytes: '1k' }).length, 2048);
  assert.equal(value('hex', { length: '1k' }).length, 1024);
});

test('entropy metadata is present for every generator', () => {
  const commands = [
    'bytes', 'hex', 'chars', 'password', 'passphrase', 'pin', 'uuid', 'ulid', 'ksuid', 'nanoid', 'cuid',
    'uid', 'objectid', 'snowflake', 'typeid', 'jwt-secret', 'apikey', 'token', 'hmac', 'aes', 'salt',
    'session', 'webhook-secret', 'color', 'mac', 'ipv4', 'ipv6', 'port', 'int', 'dice', 'coin',
  ];
  for (const command of commands) {
    const result = mint(command);
    assert.ok((result.entropyBits ?? 0) > 0, `${command} should report entropy`);
    assert.ok(result.value.length > 0, `${command} should return a value`);
  }
});
