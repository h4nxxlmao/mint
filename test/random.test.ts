import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { UsageError } from '../src/errors.js';
import {
  alphabetEntropyBits,
  randomBigIntBelow,
  randomBigIntInRange,
  randomBytes,
  randomInRange,
  randomIntBelow,
  sampleChar,
  sampleChars,
  sampleMany,
  sampleOne,
  shuffle,
} from '../src/random.js';

/** Every symbol must land within `tolerance` standard deviations of a uniform draw. */
function assertUniform(counts: number[], tolerance: number, label: string): void {
  const total = counts.reduce((sum, count) => sum + count, 0);
  const expected = total / counts.length;
  const sigma = Math.sqrt(expected * (1 - 1 / counts.length));
  counts.forEach((count, index) => {
    const deviation = Math.abs(count - expected) / sigma;
    assert.ok(
      deviation < tolerance,
      `${label}: symbol ${index} appeared ${count} times, expected ~${expected.toFixed(1)} (${deviation.toFixed(2)} sigma)`,
    );
  });
}

test('randomBytes returns the requested length', () => {
  assert.equal(randomBytes(0).length, 0);
  assert.equal(randomBytes(1).length, 1);
  assert.equal(randomBytes(64).length, 64);
});

test('randomBytes rejects absurd sizes', () => {
  assert.throws(() => randomBytes(-1), UsageError);
  assert.throws(() => randomBytes(1.5), UsageError);
  assert.throws(() => randomBytes(1024 * 1024 + 1), UsageError);
});

test('randomBytes does not repeat', () => {
  const seen = new Set(Array.from({ length: 500 }, () => randomBytes(16).toString('hex')));
  assert.equal(seen.size, 500);
});

test('randomIntBelow stays inside the range', () => {
  for (let index = 0; index < 2000; index++) {
    const value = randomIntBelow(6);
    assert.ok(Number.isInteger(value));
    assert.ok(value >= 0 && value < 6, `out of range: ${value}`);
  }
  assert.equal(randomIntBelow(1), 0);
});

test('randomIntBelow rejects invalid ranges', () => {
  assert.throws(() => randomIntBelow(0), UsageError);
  assert.throws(() => randomIntBelow(-3), UsageError);
  assert.throws(() => randomIntBelow(2 ** 32 + 1), UsageError);
});

test('randomIntBelow is uniform for a non power-of-two range', () => {
  const buckets = new Array<number>(6).fill(0);
  const draws = 60_000;
  for (let index = 0; index < draws; index++) buckets[randomIntBelow(6)]++;
  assertUniform(buckets, 5, 'randomIntBelow(6)');
});

test('randomIntBelow is uniform across a byte boundary', () => {
  const buckets = new Array<number>(58).fill(0);
  const draws = 58_000;
  for (let index = 0; index < draws; index++) buckets[randomIntBelow(58)]++;
  assertUniform(buckets, 5, 'randomIntBelow(58)');
});

test('randomInRange is inclusive and bias-free', () => {
  const buckets = new Array<number>(3).fill(0);
  for (let index = 0; index < 30_000; index++) {
    const value = randomInRange(5, 7);
    assert.ok(value >= 5 && value <= 7);
    buckets[value - 5]++;
  }
  assertUniform(buckets, 5, 'randomInRange(5, 7)');
  assert.throws(() => randomInRange(5, 4), UsageError);
});

test('randomBigIntBelow respects the exclusive bound', () => {
  const upper = 2n ** 128n;
  for (let index = 0; index < 200; index++) {
    const value = randomBigIntBelow(upper);
    assert.ok(value >= 0n && value < upper);
  }
  assert.throws(() => randomBigIntBelow(0n), UsageError);
});

test('randomBigIntInRange respects both bounds', () => {
  const seen = new Set<bigint>();
  for (let index = 0; index < 500; index++) {
    const value = randomBigIntInRange(-2n, 2n);
    assert.ok(value >= -2n && value <= 2n);
    seen.add(value);
  }
  assert.deepEqual([...seen].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), [-2n, -1n, 0n, 1n, 2n]);
});

test('sampleChars returns the requested number of in-charset characters', () => {
  const charset = 'abc';
  const text = sampleChars(500, charset);
  assert.equal(text.length, 500);
  assert.match(text, /^[abc]+$/);
});

test('sampleChars is uniform for a charset that divides 256', () => {
  const charset = '0123456789abcdef';
  const counts = new Array<number>(charset.length).fill(0);
  const text = sampleChars(64_000, charset);
  for (const char of text) counts[charset.indexOf(char)]++;
  assertUniform(counts, 5, 'sampleChars(hex)');
});

test('sampleChars is uniform for a charset that does not divide 256', () => {
  const charset = 'abcdefghij'; // 10 symbols -> rejection sampling required
  const counts = new Array<number>(charset.length).fill(0);
  const text = sampleChars(50_000, charset);
  for (const char of text) counts[charset.indexOf(char)]++;
  assertUniform(counts, 5, 'sampleChars(10)');
});

test('sampleChars is uniform for the 58-symbol base58 alphabet', () => {
  const charset = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const counts = new Array<number>(charset.length).fill(0);
  const text = sampleChars(116_000, charset);
  for (const char of text) counts[charset.indexOf(char)]++;
  assertUniform(counts, 5, 'sampleChars(base58)');
});

test('sampleChars rejects unusable input', () => {
  assert.throws(() => sampleChars(10, 'a'), UsageError);
  assert.throws(() => sampleChars(0, 'ab'), UsageError);
  assert.throws(() => sampleChars(2_000_000, 'ab'), UsageError);
});

test('sampleChar and sampleOne draw valid values', () => {
  for (let index = 0; index < 200; index++) {
    assert.match(sampleChar('xy'), /^[xy]$/);
    assert.ok(['a', 'b', 'c'].includes(sampleOne(['a', 'b', 'c'])));
  }
  assert.throws(() => sampleOne([]), UsageError);
});

test('shuffle returns a permutation', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f'];
  let changed = 0;
  for (let index = 0; index < 200; index++) {
    const result = shuffle(items);
    assert.deepEqual([...result].sort(), [...items].sort());
    if (result.join('') !== items.join('')) changed++;
  }
  assert.ok(changed > 190, `expected the order to change almost every time, changed ${changed}/200`);
  assert.deepEqual(items, ['a', 'b', 'c', 'd', 'e', 'f'], 'input must not be mutated');
});

test('shuffle positions are uniform', () => {
  const counts = new Array<number>(4).fill(0);
  for (let index = 0; index < 40_000; index++) counts[shuffle([0, 1, 2, 3])[0]]++;
  assertUniform(counts, 5, 'shuffle first position');
});

test('sampleMany returns distinct items', () => {
  const picked = sampleMany(['a', 'b', 'c', 'd'], 3);
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked).size, 3);
  assert.throws(() => sampleMany(['a', 'b'], 3), UsageError);
});

test('alphabetEntropyBits', () => {
  assert.equal(alphabetEntropyBits(1, 64), 6);
  assert.equal(alphabetEntropyBits(32, 16), 128);
  assert.ok(Math.abs(alphabetEntropyBits(20, 94) - 131) < 0.5);
  assert.equal(alphabetEntropyBits(10, 1), 0);
});
