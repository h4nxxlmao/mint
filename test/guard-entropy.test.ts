import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  classifyPlaceholder,
  entropyReason,
  extractCandidates,
  hasSequentialRun,
  isEntropySecret,
  shannonEntropy,
} from '../src/guard/entropy.js';

const OPTIONS = { threshold: 4.5, minLength: 20, maxLength: 200 };
const SECRET = 'Qm7Zx2Lp9Rt4Vb8Nc1Md6Kf3Hg5Js0Da';

test('shannon entropy of known strings', () => {
  assert.equal(shannonEntropy(''), 0);
  assert.equal(shannonEntropy('aaaa'), 0);
  assert.equal(shannonEntropy('ab'), 1);
  assert.equal(shannonEntropy('abcd'), 2);
  assert.ok(Math.abs(shannonEntropy('abcdefghijklmnopqrstuvwxyz') - Math.log2(26)) < 1e-9);
});

test('sequential runs identify alphabets and sample lists', () => {
  assert.equal(hasSequentialRun('abcdefghijklmnopqrstuvwxyz'), true);
  assert.equal(hasSequentialRun('0123456789abcdef'), true);
  assert.equal(hasSequentialRun('zyxwvutsrqponmlkjihgfedcba'), true);
  assert.equal(hasSequentialRun('ZYXWVUTSRQPONMLKJIHGFEDCBA'), true);
  assert.equal(hasSequentialRun(SECRET), false);
  assert.equal(hasSequentialRun('Qm7Z'), false);
});

test('high entropy secrets are detected', () => {
  for (const value of [
    SECRET,
    'aZ8kLm3Nq7Rt2Vx9Bc4Df6Gh1Jp5Ks0W',
    'Zx9Qw7Lp2Rt5Vb8Nc1Md4Kf6Hg3Js0Da',
  ]) {
    assert.ok(shannonEntropy(value) >= OPTIONS.threshold, `${value} is not actually high entropy`);
    assert.equal(entropyReason(value, OPTIONS), undefined, `${value} should look like a secret`);
    assert.equal(isEntropySecret(value, OPTIONS), true);
  }
});

test('false positives are rejected with a reason', () => {
  assert.equal(entropyReason('short', OPTIONS), 'too-short');
  assert.equal(entropyReason('x'.repeat(210), OPTIONS), 'too-long');
  assert.equal(entropyReason('123e4567-e89b-42d3-a456-426614174000', OPTIONS), 'uuid');
  assert.equal(entropyReason('a1b2c3d4e5f60718293a4b5c6d7e8f90', OPTIONS), 'digest');
  assert.equal(entropyReason('f'.repeat(64), OPTIONS), 'digest');
  assert.equal(entropyReason('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg', OPTIONS), 'image');
  assert.equal(entropyReason('https://internal.corp/some/long/path/here', OPTIONS), 'url');
  assert.equal(entropyReason('this is a sentence with several words in it', OPTIONS), 'code');
  assert.equal(entropyReason('changeme-changeme-changeme', OPTIONS), 'placeholder');
  assert.equal(entropyReason('your_api_key_goes_right_here', OPTIONS), 'placeholder');
  assert.equal(entropyReason('${API_KEY_VALUE_FROM_ENV_CONFIG}', OPTIONS), 'placeholder');
  assert.equal(entropyReason('abcdefghijklmnopqrstuvwxyz', OPTIONS), 'prose');
  assert.equal(entropyReason('ABCDEFGHIJKLMNOPQRSTUVWXYZ', OPTIONS), 'prose');
});

test('threshold is honoured and tunable', () => {
  assert.equal(isEntropySecret(SECRET, { ...OPTIONS, threshold: 4.5 }), true);
  assert.equal(isEntropySecret(SECRET, { ...OPTIONS, threshold: 8 }), false);
});

test('minimum and maximum length are honoured', () => {
  assert.equal(entropyReason('aB3dE5fG7hJ9', { ...OPTIONS, minLength: 20 }), 'too-short');
  assert.equal(entropyReason(SECRET, { ...OPTIONS, minLength: 10 }), undefined);
  assert.equal(entropyReason(SECRET, { ...OPTIONS, maxLength: 10 }), 'too-long');
});

test('single-case candidates need to be clearly random', () => {
  const lowercase = 'qwertyuiopasdfghjklzxcvbnm';
  // 4.7 bits per character: below the +0.8 margin for single-case strings.
  assert.equal(entropyReason(lowercase, OPTIONS), 'weak');
  assert.equal(isEntropySecret(lowercase, { ...OPTIONS, threshold: 3.5 }), true);
});

test('code-like values are rejected even when they are random-looking', () => {
  assert.equal(entropyReason('Qm7Zx2Lp9Rt4Vb8Nc1Md6Kf3Hg5Js0Da${suffix}', OPTIONS), 'code');
  assert.equal(entropyReason('Qm7Zx2Lp9Rt4Vb8Nc1Md6Kf3Hg5Js0Da)', OPTIONS), 'code');
  assert.equal(entropyReason('Qm7Zx2Lp9Rt4Vb8Nc1Md6Kf3Hg5Js0Da;', OPTIONS), 'code');
  assert.equal(entropyReason('Qm7Zx2Lp9Rt4Vb8Nc1Md6Kf3Hg5Js0Da backtick`', OPTIONS), 'code');
});

test('placeholders are classified', () => {
  for (const value of ['changeme', 'CHANGE_ME', 'your-key-here', 'replace-me', 'xxxxxxxx', '<token>', '${ENV}', 'null', 'string']) {
    assert.notEqual(classifyPlaceholder(value), undefined, `${value} should be a placeholder`);
  }
  for (const value of [SECRET, 'hunter2hunter2']) {
    assert.equal(classifyPlaceholder(value), undefined, `${value} should not be a placeholder`);
  }
});

test('candidate extraction finds quoted strings and assignment values', () => {
  const line = `const apiKey = "${SECRET}", other = '${'Xk9mQ2pL7wR4vT8nB3cF6hJ1'}';`;
  const candidates = extractCandidates(line).map((item) => item.value);
  assert.ok(candidates.includes(SECRET));
  assert.ok(candidates.includes('Xk9mQ2pL7wR4vT8nB3cF6hJ1'));
});

test('candidate extraction keeps offsets inside the line', () => {
  const line = `value = "${SECRET}"`;
  const [candidate] = extractCandidates(line);
  assert.equal(line.slice(candidate.index, candidate.index + candidate.value.length), candidate.value);
});
