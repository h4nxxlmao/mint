import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { inspectFound, inspectValue, renderInspection } from '../src/inspect.js';
import { plainPalette } from '../src/colors.js';

const UUID_V5 = 'cfbff0d1-9375-5685-968c-48ce8b15ae17';
const ULID = '01M57Q0QNXBP0EZ0SD577CK4QF';
const TYPEID = 'user_06gmyw31qswcxbbqkgcg79mw4c';
const KSUID = '3KsIlv1w2udqsl8BonJpqJQ2uxl';
const OBJECT_ID = '6ad4f02a5a3b7c9e1f2d3c4b';
const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

function formats(value: string): string[] {
  return inspectValue(value).matches.map((match) => match.format);
}

test('inspect recognises every generated identifier format', () => {
  assert.deepEqual(formats(UUID_V5), ['uuid']);
  assert.match(inspectValue(UUID_V5).matches[0].detail, /version 5/u);

  assert.deepEqual(formats(ULID), ['ulid']);
  assert.match(inspectValue(ULID).matches[0].detail, /^timestamp \d{4}-\d{2}-\d{2}T/u);

  assert.deepEqual(formats(TYPEID), ['typeid']);
  assert.match(inspectValue(TYPEID).matches[0].detail, /type "user"/u);

  assert.deepEqual(formats(KSUID), ['ksuid']);
  assert.deepEqual(formats(OBJECT_ID), ['objectid']);
  assert.deepEqual(formats('1561411884051330146'), ['snowflake']);
});

test('inspect recognises a JWT and decodes its header', () => {
  const inspection = inspectValue(JWT);
  assert.deepEqual(inspection.matches.map((match) => match.format), ['jwt']);
  assert.match(inspection.matches[0].detail, /alg HS256/u);
});

test('inspect identifies encodings only when nothing structured matched', () => {
  assert.deepEqual(formats('5f4dcc3b5aa765d61d8327deb882cf99'), ['hex']);
  assert.match(inspectValue('5f4dcc3b5aa765d61d8327deb882cf99').matches[0].detail, /MD5/u);
  assert.deepEqual(formats('ABANDONABANDONABANDONABANDONAB'), ['base32']);
  assert.deepEqual(formats('RU60QRQX86KotfP258JOcaUCw8vlsGhLZcSeG0C_-Rc'), ['base64url']);
});

test('inspect does not mistake a digest for a UUID', () => {
  // A 32 character hash has no version/variant nibbles, so it is not a compact UUID.
  assert.ok(!formats('5f4dcc3b5aa765d61d8327deb882cf99').includes('uuid'));
  assert.ok(formats('cfbff0d15f6e5685968c48ce8b15ae17').includes('uuid'));
});

test('inspect reports shape statistics', () => {
  const inspection = inspectValue(ULID);
  assert.equal(inspection.length, 26);
  assert.equal(inspection.charset, 'uppercase + digits');
  assert.ok(inspection.entropyPerCharacter > 3);
  assert.equal(inspectValue('hello').charset, 'lowercase');
  assert.equal(inspectValue('abc123').charset, 'lowercase + digits');
});

test('inspect flags values that look like leaked secrets', () => {
  const inspection = inspectValue(`sk_live_${'a1B2c3D4e5F6g7H8i9J0k1L2'}`);
  assert.equal(inspection.findings.length, 1);
  assert.equal(inspection.findings[0].ruleId, 'stripe-secret-key');
  assert.ok(inspectFound(inspection.matches, inspection.findings));
});

test('inspect never echoes the value it was given', () => {
  const secret = `sk_live_${'a1B2c3D4e5F6g7H8i9J0k1L2'}`;
  const inspection = inspectValue(secret);
  const text = renderInspection(inspection, 'text', plainPalette);
  const json = renderInspection(inspection, 'json', plainPalette);
  assert.ok(!text.includes(secret));
  assert.ok(!json.includes(secret));
  assert.match(text, /stripe-secret-key/u);
});

test('inspect exit signal distinguishes recognised values', () => {
  assert.equal(inspectFound(inspectValue(ULID).matches, []), true);
  const unknown = inspectValue('hello');
  assert.deepEqual(unknown.matches, []);
  assert.equal(inspectFound(unknown.matches, unknown.findings), false);
});

test('inspect json exposes formats and a redacted secret verdict', () => {
  const inspection = inspectValue(`sk_live_${'a1B2c3D4e5F6g7H8i9J0k1L2'}`);
  const parsed = JSON.parse(renderInspection(inspection, 'json', plainPalette));
  assert.equal(parsed.recognized, true);
  assert.ok(Array.isArray(parsed.formats));
  assert.equal(parsed.secret.detected, true);
  assert.equal(parsed.secret.findings[0].rule, 'stripe-secret-key');
  assert.match(parsed.secret.findings[0].preview, /^sk_l\.\.\.L2$/u);
});
