import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildAliasMap, parseArgs } from '../src/args.js';
import { UsageError } from '../src/errors.js';
import { buildSpecMap } from '../src/specs.js';

const SPECS = buildSpecMap();
const ALIASES = buildAliasMap(SPECS);
const parse = (argv: string[]) => parseArgs(argv, SPECS, ALIASES);

function captureError(action: () => unknown): UsageError {
  try {
    action();
  } catch (error) {
    assert.ok(error instanceof UsageError, `expected a UsageError, got ${String(error)}`);
    return error;
  }
  throw new Error('expected the call to throw a UsageError');
}

test('parses a command with space separated flags', () => {
  const parsed = parse(['chars', '--length', '16', '--charset', 'safe']);
  assert.equal(parsed.command, 'chars');
  assert.equal(parsed.flags.getString('length'), '16');
  assert.equal(parsed.flags.getString('charset'), 'safe');
});

test('parses --flag=value', () => {
  const parsed = parse(['chars', '--length=24']);
  assert.equal(parsed.flags.getString('length'), '24');
});

test('parses short flags and attached values', () => {
  assert.equal(parse(['chars', '-l', '16']).flags.getString('length'), '16');
  assert.equal(parse(['chars', '-l16']).flags.getString('length'), '16');
  assert.equal(parse(['chars', '-l=16']).flags.getString('length'), '16');
  assert.equal(parse(['chars', '-b', '8']).flags.getString('bytes'), '8');
});

test('collects positionals after the command', () => {
  const parsed = parse(['pick', 'red', 'green', 'blue']);
  assert.equal(parsed.command, 'pick');
  assert.deepEqual(parsed.positionals, ['red', 'green', 'blue']);
});

test('handles -- to stop flag parsing', () => {
  const parsed = parse(['pick', '--', '--length', '-x']);
  assert.deepEqual(parsed.positionals, ['--length', '-x']);
});

test('negated booleans set the canonical flag to false', () => {
  assert.equal(parse(['uuid', '--no-dashes']).flags.getBool('dashes', true), false);
  assert.equal(parse(['uuid', '--no-dashes']).flags.getBool('dashes'), false);
  assert.equal(parse(['uuid']).flags.getBool('dashes', true), true);
});

test('-n is the short form of --no-newline', () => {
  assert.equal(parse(['uuid', '-n']).flags.getBool('newline', true), false);
});

test('accepts negative numbers as flag values', () => {
  const parsed = parse(['int', '--min', '-100', '--max', '-1']);
  assert.equal(parsed.flags.getString('min'), '-100');
  assert.equal(parsed.flags.getString('max'), '-1');
  assert.deepEqual(parsed.positionals, []);
});

test('rejects unknown flags with a suggestion', () => {
  const error = captureError(() => parse(['uuid', '--lenght', '8']));
  assert.match(error.message, /unknown flag --lenght/);
  assert.match(error.hint ?? '', /--length/);
  assert.equal(error.exitCode, 2);
});

test('rejects a value flag without a value', () => {
  const error = captureError(() => parse(['chars', '--length']));
  assert.match(error.message, /requires a value/);
});

test('rejects a value for a boolean flag', () => {
  assert.throws(() => parse(['uuid', '--upper=yes']), UsageError);
});

test('last boolean occurrence wins', () => {
  assert.equal(parse(['uuid', '--dashes', '--no-dashes']).flags.getBool('dashes', true), false);
  assert.equal(parse(['uuid', '--no-dashes', '--dashes']).flags.getBool('dashes', true), true);
});
