#!/usr/bin/env node
/**
 * Exhaustive end-to-end verification of the CLI.
 *
 * Drives every generator through the real command line - every declared flag,
 * every output mode, the help screens and the error paths - and checks the
 * shape of what comes back. Run it against the build, or against an installed
 * binary:
 *
 *   node scripts/verify.mjs              # dist/cli.js
 *   node scripts/verify.mjs --bin mint   # whatever `mint` resolves to on PATH
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { GENERATORS } from '../dist/registry.js';
import { specFor } from '../dist/specs.js';

const args = process.argv.slice(2);
const binIndex = args.indexOf('--bin');
const useBin = binIndex !== -1 ? args[binIndex + 1] : undefined;
const CLI = useBin ? [] : [fileURLToPath(new URL('../dist/cli.js', import.meta.url))];
const COMMAND = useBin ?? process.execPath;

const PACKAGE = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const POSITIONALS = {
  dice: ['2d6'],
  pick: ['red', 'green', 'blue'],
  shuffle: ['a', 'b', 'c', 'd'],
  typeid: ['user'],
};

/** Expected shape of the default output of every generator. */
const SHAPES = {
  bytes: /^[0-9a-f]{64}$/,
  hex: /^[0-9a-f]{64}$/,
  base64: /^[A-Za-z0-9+/]{43}=$/,
  base64url: /^[A-Za-z0-9_-]{43}$/,
  base32: /^[A-Z2-7]{52}={4}$/,
  base58: /^[1-9A-HJ-NP-Za-km-z]{42,44}$/,
  crockford: /^[0-9A-HJKMNP-TV-Z]{52}$/,
  binary: /^[01]{32}$/,
  chars: /^[A-Za-z0-9]{32}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{20}$/,
  passphrase: /^([a-z]+-){5}[a-z]+$/,
  pin: /^\d{6}$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  ulid: /^[0-9A-HJKMNP-TV-Z]{26}$/,
  ksuid: /^[0-9A-Za-z]{27}$/,
  nanoid: /^[A-Za-z0-9_-]{21}$/,
  cuid: /^[a-z][a-z0-9]{23}$/,
  uid: /^[A-Za-z0-9_-]{16}$/,
  objectid: /^[0-9a-f]{24}$/,
  snowflake: /^\d{18,19}$/,
  typeid: /^user_[0-9a-hjkmnp-tv-z]{26}$/,
  'jwt-secret': /^[A-Za-z0-9_-]{43}$/,
  apikey: /^sk_live_[A-Za-z0-9]{32}$/,
  token: /^[A-Za-z0-9_-]{43}$/,
  hmac: /^[0-9a-f]{64}$/,
  aes: /^[0-9a-f]{64}$/,
  salt: /^[0-9a-f]{32}$/,
  session: /^[A-Za-z0-9_-]{43}$/,
  'webhook-secret': /^whsec_[A-Za-z0-9+/]{43}=$/,
  int: /^\d+$/,
  dice: /^\d{1,2}$/,
  coin: /^(heads|tails)$/,
  pick: /^(red|green|blue)$/,
  shuffle: /^([abcd]\n){3}[abcd]$/,
  color: /^#[0-9a-f]{6}$/,
  mac: /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/,
  ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
  ipv6: /^([0-9a-f]{4}:){7}[0-9a-f]{4}$/,
  port: /^\d{1,5}$/,
};

/** Sample value for each non-boolean flag, per generator where it matters. */
const VALUES = {
  length: '12',
  size: '12',
  bytes: '8',
  bits: '64',
  charset: 'safe',
  exclude: '0Oo1',
  separator: '_',
  alphabet: 'abcdef',
  format: 'hex',
  algo: 'sha256',
  type: 'user',
  min: '1',
  max: '100',
  worker: '7',
  words: '4',
  env: 'VAR',
  prefix: 'p-',
  suffix: '-s',
};

const PER_GENERATOR_VALUES = {
  'jwt-secret': { algo: 'hs512' },
  hmac: { algo: 'sha512' },
  aes: { bits: '128', bytes: '16' },
  color: { format: 'rgb' },
  ksuid: { format: 'hex' },
  cuid: { length: '12', size: '12' },
  apikey: { length: '12', size: '12' },
};

/** Flags a generator consumes itself, so the global meaning does not apply. */
const CONSUMES_PREFIX = new Set(['apikey', 'webhook-secret']);

const failures = [];
let checks = 0;

// On Windows a .cmd shim cannot be spawned directly, so reach it through cmd.exe
// (cmd is only used to resolve the shim; arguments are still passed as an argv array).
const needsCmd = Boolean(useBin) && process.platform === 'win32';
const EXECUTABLE = needsCmd ? (process.env.ComSpec ?? 'cmd.exe') : COMMAND;
const EXECUTABLE_PREFIX = needsCmd ? ['/d', '/s', '/c'] : [];

function run(commandArgs, env = {}) {
  const result = spawnSync(EXECUTABLE, [...EXECUTABLE_PREFIX, ...CLI, ...commandArgs], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', ...env },
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    signal: result.signal,
  };
}

function check(label, condition, detail) {
  checks++;
  if (!condition) failures.push({ label, detail });
  return condition;
}

function expectOk(label, commandArgs, { env } = {}) {
  const result = run(commandArgs, env);
  return check(label, result.status === 0 && !result.signal, `exit ${result.status}${result.signal ? ` signal ${result.signal}` : ''} / stderr: ${result.stderr.trim()}`);
}

function expectFailure(label, commandArgs, status) {
  const result = run(commandArgs);
  return check(label, result.status === status, `expected exit ${status}, got ${result.status} (stderr: ${result.stderr.trim()})`);
}

const generatorArgs = (generator) => POSITIONALS[generator.name] ?? [];

// ---------------------------------------------------------------- generators
const shapeResults = new Map();

for (const generator of GENERATORS) {
  const base = [generator.name, ...generatorArgs(generator)];
  const label = `mint ${base.join(' ')}`;

  const plain = run(base);
  checks++;
  const shape = SHAPES[generator.name];
  const trimmed = plain.stdout.replace(/\n$/, '');
  const ok =
    plain.status === 0 &&
    trimmed.length > 0 &&
    shape !== undefined &&
    shape.test(trimmed);
  if (!ok) {
    failures.push({
      label: `${label} (default output)`,
      detail: `exit ${plain.status}, stdout ${JSON.stringify(trimmed.slice(0, 80))}, expected ${String(shape)}`,
    });
  }
  shapeResults.set(generator.name, ok);

  // every declared flag, one at a time
  for (const flagName of generator.flags ?? []) {
    const spec = specFor(flagName);
    if (!spec || flagName === 'quiet') continue;
    const value = { ...VALUES, ...(PER_GENERATOR_VALUES[generator.name] ?? {}) }[flagName];

    if (spec.type === 'boolean') {
      const spelling = spec.shownAs ?? `--${spec.name}`;
      const negated = spelling.startsWith('--no-') ? `--${spec.name}` : `--no-${spec.name}`;
      expectOk(`mint ${generator.name} ${spelling}`, [...base, spelling]);
      expectOk(`mint ${generator.name} ${negated}`, [...base, negated]);
    } else if (value !== undefined) {
      expectOk(`mint ${generator.name} --${flagName} ${value}`, [...base, `--${flagName}`, value]);
    }
  }

  // output modes
  const json = run([...base, '--json']);
  checks++;
  let jsonOk = false;
  let jsonDetail = `exit ${json.status}`;
  try {
    const parsed = JSON.parse(json.stdout);
    jsonOk =
      parsed !== null &&
      typeof parsed === 'object' &&
      typeof parsed.value === 'string' &&
      parsed.value.length > 0 &&
      parsed.generator === generator.name;
    jsonDetail = `unexpected payload: ${json.stdout.slice(0, 120)}`;
  } catch (error) {
    jsonDetail = `not JSON: ${json.stdout.slice(0, 120)} (${String(error)})`;
  }
  check(`mint ${generator.name} --json`, jsonOk, jsonDetail);

  const three = run([...base, '--count', '3']);
  checks++;
  check(
    `mint ${generator.name} --count 3`,
    three.status === 0 && three.stdout.trim().length > 0 && three.stdout.split('\n').filter((line) => line !== '').length >= 1,
    `exit ${three.status}, stdout ${JSON.stringify(three.stdout.slice(0, 60))}`,
  );

  const env = run([...base, '--env', 'SECRET']);
  checks++;
  check(
    `mint ${generator.name} --env SECRET`,
    env.status === 0 && /^SECRET=.+/m.test(env.stdout),
    `exit ${env.status}, stdout ${JSON.stringify(env.stdout.slice(0, 60))}`,
  );

  const noNewline = run([...base, '--no-newline']);
  checks++;
  check(
    `mint ${generator.name} --no-newline`,
    noNewline.status === 0 && !noNewline.stdout.endsWith('\n') && noNewline.stdout.length > 0,
    `exit ${noNewline.status}, ends with newline: ${noNewline.stdout.endsWith('\n')}`,
  );

  const entropy = run([...base, '--entropy']);
  checks++;
  check(
    `mint ${generator.name} --entropy`,
    entropy.status === 0 && /^entropy: /m.test(entropy.stderr) && entropy.stdout.trim().length > 0,
    `exit ${entropy.status}, stderr ${JSON.stringify(entropy.stderr)}`,
  );

  const suffixed = run([...base, '--suffix', '-s']);
  checks++;
  check(
    `mint ${generator.name} --suffix -s`,
    suffixed.status === 0 && suffixed.stdout.replace(/\n$/, '').endsWith('-s'),
    `exit ${suffixed.status}, stdout ${JSON.stringify(suffixed.stdout.slice(0, 60))}`,
  );

  if (!CONSUMES_PREFIX.has(generator.name)) {
    const prefixed = run([...base, '--prefix', 'p-']);
    checks++;
    check(
      `mint ${generator.name} --prefix p-`,
      prefixed.status === 0 && prefixed.stdout.startsWith('p-'),
      `exit ${prefixed.status}, stdout ${JSON.stringify(prefixed.stdout.slice(0, 60))}`,
    );
  }
}

// ------------------------------------------------------------------- help
const mainHelp = run(['--help']);
checks++;
check('mint --help', mainHelp.status === 0 && /generators/.test(mainHelp.stdout), `exit ${mainHelp.status}`);
for (const generator of GENERATORS) {
  checks++;
  const missing = !new RegExp(`\\b${generator.name}\\b`).test(mainHelp.stdout);
  if (missing) failures.push({ label: `mint --help lists ${generator.name}`, detail: 'generator missing from the help screen' });
}

for (const generator of GENERATORS) {
  const help = run([generator.name, '--help']);
  checks++;
  check(
    `mint ${generator.name} --help`,
    help.status === 0 && help.stdout.includes('usage') && help.stdout.includes(generator.name),
    `exit ${help.status}, stdout ${JSON.stringify(help.stdout.slice(0, 60))}`,
  );
  const viaHelpCommand = run(['help', generator.name]);
  checks++;
  check(
    `mint help ${generator.name}`,
    viaHelpCommand.status === 0 && viaHelpCommand.stdout === help.stdout,
    `exit ${viaHelpCommand.status}`,
  );
}

const bare = run([]);
checks++;
check('mint (no arguments) prints help', bare.status === 0 && /generators/.test(bare.stdout), `exit ${bare.status}`);

const version = run(['--version']);
checks++;
check(
  'mint --version',
  version.status === 0 && version.stdout.trim() === PACKAGE.version,
  `${version.stdout.trim()} !== ${PACKAGE.version}`,
);

// -------------------------------------------------------------- shorthand
for (const [invocation, pattern] of [
  [['32'], /^[0-9a-f]{64}$/],
  [['16', '--base64'], /^[A-Za-z0-9+/]{22}==$/],
  [['16', '--base58'], /^[1-9A-HJ-NP-Za-km-z]+$/],
  [['12', '--base32'], /^[A-Z2-7]+=*$/],
  [['1k', '--hex'], /^[0-9a-f]{2048}$/],
  [['64', '--upper'], /^[0-9A-F]{128}$/],
  [['32', '--binary'], /^[01]{256}$/],
]) {
  const result = run(invocation);
  checks++;
  check(
    `mint ${invocation.join(' ')}`,
    result.status === 0 && pattern.test(result.stdout.trim()),
    `exit ${result.status}, stdout ${JSON.stringify(result.stdout.slice(0, 40))}`,
  );
}

// ---------------------------------------------------------- error handling
const errorCases = [
  [['uudi'], 2],
  [['nope'], 2],
  [['uuid', '--lenth', '8'], 2],
  [['uuid', '--charset', 'abc'], 2],
  [['uuid', 'oops'], 2],
  [['hex', '--bytes'], 2],
  [['hex', '--bytes', 'abc'], 2],
  [['hex', '--bytes', '0'], 2],
  [['hex', '--bytes', '8', '--bits', '64'], 2],
  [['hex', '--length', '2000000'], 2],
  [['32', '--bytes', '4'], 2],
  [['2d6'], 2],
  [['dice', '2x6'], 2],
  [['dice', '1d1'], 2],
  [['pick'], 2],
  [['shuffle'], 2],
  [['int', '--min', '10', '--max', '1'], 2],
  [['aes', '--bits', '64'], 2],
  [['aes', '--bytes', '20'], 2],
  [['cuid', '--length', '1'], 2],
  [['apikey', '--length', '4'], 2],
  [['typeid', '--type', 'Nope'], 2],
  [['typeid', '--type', 'x'.repeat(64)], 2],
  [['snowflake', '--worker', '5000'], 2],
  [['jwt-secret', '--algo', 'md5'], 2],
  [['port', '--min', '100', '--max', '90'], 2],
  [['chars', '--charset', 'a'], 2],
  [['uuid', '--upper=yes'], 2],
];
for (const [invocation, status] of errorCases) {
  expectFailure(`error: mint ${invocation.join(' ')} -> exit ${status}`, invocation, status);
}

// ------------------------------------------------------------------ extras
expectOk('mint hex --bytes 4 --copy', ['hex', '--bytes', '4', '--copy']);
expectOk('mint uuid --no-color', ['uuid', '--no-color']);
expectOk('mint uuid --upper --no-dashes', ['uuid', '--upper', '--no-dashes']);
expectOk('mint passphrase --words 8 --separator . --capitalize --number', ['passphrase', '--words', '8', '--separator', '.', '--capitalize', '--number']);
expectOk('mint aes --bits 256 --iv', ['aes', '--bits', '256', '--iv']);
expectOk('mint pick a b c --count 2 --unique', ['pick', 'a', 'b', 'c', '--count', '2', '--unique']);
expectOk('mint shuffle a b c --count 2', ['shuffle', 'a', 'b', 'c', '--count', '2']);
expectOk('mint chars --charset "abc123" --require-each --length 6', ['chars', '--charset', 'abc123', '--require-each', '--length', '6']);
expectOk('mint chars --bits 256', ['chars', '--bits', '256']);
expectOk('mint int --bits 128', ['int', '--bits', '128']);
expectOk('mint 32 --count 3', ['32', '--count', '3']);
expectOk('mint uuid --v7 --json --count 3', ['uuid', '--v7', '--json', '--count', '3']);

// distinct values across runs (only for generators with plenty of entropy)
const uniqueness = ['bytes', 'uuid', 'ulid', 'ksuid', 'nanoid', 'cuid', 'uid', 'objectid', 'snowflake', 'aes', 'token', 'session', 'apikey', 'jwt-secret', 'passphrase', 'password', 'salt', 'hmac', 'typeid', 'webhook-secret', 'base58', 'mac', 'ipv6'];
for (const name of uniqueness) {
  const seen = new Set();
  for (let index = 0; index < 25; index++) {
    const result = run([name, ...(POSITIONALS[name] ?? [])]);
    seen.add(result.stdout.trim());
  }
  checks++;
  if (seen.size !== 25) {
    failures.push({ label: `mint ${name} uniqueness (25 runs)`, detail: `${seen.size}/25 distinct values` });
  }
}

// ------------------------------------------------------------------ report
const width = Math.max(...GENERATORS.map((generator) => generator.name.length));
console.log(`mint ${PACKAGE.version} - verifying ${useBin ? `"${useBin}" from PATH` : 'dist/cli.js'}`);
console.log('');
for (const generator of GENERATORS) {
  const mark = shapeResults.get(generator.name) ? 'ok  ' : 'FAIL';
  console.log(`  ${mark}  ${generator.name.padEnd(width)}  ${generator.summary}`);
}
console.log('');
console.log(`  ${checks} checks run, ${failures.length} failed`);

if (failures.length > 0) {
  console.log('');
  console.log('  failures:');
  for (const failure of failures) {
    console.log(`   - ${failure.label}`);
    console.log(`     ${failure.detail}`);
  }
  process.exit(1);
}
