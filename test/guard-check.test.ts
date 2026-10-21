import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { cliPath } from './guard-fixtures.js';

const STRIPE_KEY = `sk_live_${'a1B2c3D4e5F6g7H8i9J0k1L2'}`;
const PASSWORD = 'Xk9mQ2pL7wR4vT8nB3cF6hJ1';

function run(args: string[], options: { input?: string; cwd?: string } = {}) {
  const result = spawnSync(process.execPath, [cliPath(), 'guard', 'check', ...args], {
    encoding: 'utf8',
    cwd: options.cwd,
    input: options.input,
    windowsHide: true,
    env: { ...process.env, NO_COLOR: '1' },
  });
  return { status: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

test('check identifies a secret passed as an argument', () => {
  const result = run([STRIPE_KEY]);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /stripe-secret-key/u);
  assert.match(result.stdout, /CRITICAL/u);
  assert.match(result.stdout, /rotate it first/u);
  assert.match(result.stdout, /mint apikey --prefix sk_live_/u);
  assert.ok(!result.stdout.includes(STRIPE_KEY), 'check must not echo the raw value');
  assert.match(result.stdout, /sk_l...L2/u);
});

test('check reads the value from stdin and keeps it out of argv', () => {
  const result = run([], { input: `${STRIPE_KEY}\n` });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /stripe-secret-key/u);
  assert.ok(!result.stdout.includes(STRIPE_KEY));
  assert.ok(!/shell history/u.test(result.stdout), 'stdin input should not show the history tip');
});

test('check reports a clean value', () => {
  const result = run(['just some ordinary words in a sentence']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /no known secret pattern/u);
});

test('check honours --fail-on', () => {
  const medium = run([`password = '${PASSWORD}'`]);
  assert.equal(medium.status, 1, medium.stdout);
  assert.match(medium.stdout, /generic-assignment/u);

  const onlyCritical = run([`password = '${PASSWORD}'`, '--fail-on', 'critical']);
  assert.equal(onlyCritical.status, 0, onlyCritical.stdout);
});

test('check emits json', () => {
  const result = run([STRIPE_KEY, '--json']);
  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.detected, true);
  assert.equal(parsed.tool, 'mint guard');
  assert.equal(parsed.findings[0].rule, 'stripe-secret-key');
  assert.equal(parsed.findings[0].severity, 'critical');
  assert.ok(parsed.input.entropyPerCharacter > 3);
  assert.ok(!JSON.stringify(parsed).includes(STRIPE_KEY), 'json must not contain the raw value');
});

test('check rejects empty input', () => {
  const result = run([]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /nothing on stdin|check needs a value/u);

  const blank = run(['   ']);
  assert.equal(blank.status, 2);
  assert.match(blank.stderr, /empty/u);
});

test('check rejects unsupported formats', () => {
  const result = run([STRIPE_KEY, '--format', 'sarif']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /text or json/u);
});
