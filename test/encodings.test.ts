import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  BASE58_ALPHABET,
  CROCKFORD_ALPHABET,
  decodeBase32,
  decodeBase58,
  encodeBase32,
  encodeBase58,
  encodeBase62,
  encodeBase64,
  encodeCrockford,
  encodeHex,
  encodePowerOfTwo,
  toBinaryString,
} from '../src/encodings.js';

const FOOBAR = Buffer.from('foobar', 'utf8');

test('hex encoding', () => {
  assert.equal(encodeHex(FOOBAR), '666f6f626172');
  assert.equal(encodeHex(FOOBAR, { upper: true }), '666F6F626172');
});

test('base64 encoding matches rfc 4648 vectors', () => {
  assert.equal(encodeBase64(Buffer.from('')), '');
  assert.equal(encodeBase64(Buffer.from('f')), 'Zg==');
  assert.equal(encodeBase64(Buffer.from('fo')), 'Zm8=');
  assert.equal(encodeBase64(FOOBAR), 'Zm9vYmFy');
  assert.equal(encodeBase64(FOOBAR, { padding: false }), 'Zm9vYmFy');
  assert.equal(encodeBase64(Buffer.from('f'), { padding: false }), 'Zg');
});

test('base64url avoids + and /', () => {
  const bytes = Buffer.from([0xfb, 0xff, 0xbf]);
  assert.match(encodeBase64(bytes, { url: true }), /^[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(encodeBase64(bytes, { url: false }), /^[A-Za-z0-9_-]+$/);
});

test('base32 matches rfc 4648 vectors', () => {
  assert.equal(encodeBase32(Buffer.from('f')), 'MY======');
  assert.equal(encodeBase32(Buffer.from('fo')), 'MZXQ====');
  assert.equal(encodeBase32(Buffer.from('foo')), 'MZXW6===');
  assert.equal(encodeBase32(FOOBAR), 'MZXW6YTBOI======');
  assert.equal(encodeBase32(FOOBAR, { padding: false }), 'MZXW6YTBOI');
});

test('base32 round trips', () => {
  for (const text of ['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar']) {
    const bytes = Buffer.from(text, 'utf8');
    assert.deepEqual(decodeBase32(encodeBase32(bytes)), bytes);
    assert.deepEqual(decodeBase32(encodeBase32(bytes, { padding: false })), bytes);
  }
});

test('crockford base32 strips padding by default and excludes I L O U', () => {
  const encoded = encodeCrockford(FOOBAR);
  assert.equal(encoded, 'CSQPYRK1E8');
  assert.doesNotMatch(encoded, /[ILOU]/);
  assert.equal(encodeCrockford(Buffer.from('f'), { padding: true }), 'CR======');
  assert.equal(CROCKFORD_ALPHABET.length, 32);
  assert.deepEqual(decodeBase32(encoded, CROCKFORD_ALPHABET), FOOBAR);
});

test('base58 matches bitcoin vectors', () => {
  assert.equal(encodeBase58(Buffer.from('hello world', 'utf8')), 'StV1DL6CwTryKyV');
  assert.equal(encodeBase58(Buffer.from([0x00, 0x00, 0x01])), '112');
  assert.equal(encodeBase58(Buffer.from([0x00])), '1');
  assert.equal(encodeBase58(Buffer.alloc(0)), '');
});

test('base58 round trips', () => {
  for (const bytes of [Buffer.from([0x00, 0x01, 0x02]), Buffer.from('mint', 'utf8'), Buffer.from([0, 0, 0, 255])]) {
    assert.deepEqual(decodeBase58(encodeBase58(bytes)), bytes);
  }
});

test('base58 alphabet has no look-alike characters', () => {
  assert.equal(BASE58_ALPHABET.length, 58);
  assert.doesNotMatch(BASE58_ALPHABET, /[0OIl]/);
});

test('base62 is fixed width and zero padded', () => {
  assert.equal(encodeBase62(Buffer.alloc(20), 27), '0'.repeat(27));
  assert.equal(encodeBase62(Buffer.from([1]), 5), '00001');
  assert.equal(encodeBase62(Buffer.alloc(20).fill(0xff), 27).length, 27);
});

test('encodePowerOfTwo covers arbitrary bit widths', () => {
  assert.equal(encodePowerOfTwo(Buffer.from([0xff]), '01', 1), '11111111');
  assert.equal(encodePowerOfTwo(Buffer.from([0x00]), '01', 1), '00000000');
  assert.equal(encodePowerOfTwo(Buffer.from([0x0f]), '0123456789abcdef', 4), '0f');
});

test('binary string is truncated to the requested bit count', () => {
  assert.equal(toBinaryString(Buffer.from([0b10110011, 0b11000011]), 8), '10110011');
  assert.equal(toBinaryString(Buffer.from([0b10110011, 0b11000011]), 12), '101100111100');
});
