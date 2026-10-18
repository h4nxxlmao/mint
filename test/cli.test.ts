import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../src/cli.js', import.meta.url));

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function run(args: string[], env: Record<string, string> = {}): RunResult {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', ...env },
    windowsHide: true,
  });
  return { status: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

test('no arguments prints the help screen', () => {
  const { status, stdout } = run([]);
  assert.equal(status, 0);
  assert.match(stdout, /generators/u);
  assert.match(stdout, /uuid/u);
  assert.match(stdout, /passphrase/u);
  assert.match(stdout, /typeid/u);
});

test('--help and help subcommand', () => {
  assert.equal(run(['--help']).status, 0);
  assert.match(run(['--help']).stdout, /generators/u);
  const command = run(['uuid', '--help']);
  assert.equal(command.status, 0);
  assert.match(command.stdout, /mint uuid/u);
  assert.equal(run(['help', 'uuid']).stdout, command.stdout);
});

test('--version prints the version', () => {
  const { status, stdout } = run(['--version']);
  assert.equal(status, 0);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/u);
});

test('shorthand mint 32 prints 32 random bytes as hex', () => {
  const { status, stdout } = run(['32']);
  assert.equal(status, 0);
  assert.match(stdout.trim(), /^[0-9a-f]{64}$/u);
});

test('shorthand accepts encoding flags and size suffixes', () => {
  assert.match(run(['16', '--base64']).stdout.trim(), /^[A-Za-z0-9+/]{22}==$/u);
  assert.match(run(['16', '--base58']).stdout.trim(), /^[1-9A-HJ-NP-Za-km-z]+$/u);
  assert.match(run(['2k', '--hex']).stdout.trim(), /^[0-9a-f]{4096}$/u);
});

test('output is pipe friendly: one line per value, trailing newline', () => {
  const single = run(['uuid']).stdout;
  assert.equal(single.split('\n').length, 2);
  assert.ok(single.endsWith('\n'));
  const many = run(['uuid', '--count', '3']).stdout.trim().split('\n');
  assert.equal(many.length, 3);
  assert.equal(new Set(many).size, 3);
});

test('--no-newline suppresses the trailing newline', () => {
  assert.ok(!run(['uuid', '--no-newline']).stdout.endsWith('\n'));
  assert.ok(!run(['uuid', '-n']).stdout.endsWith('\n'));
  assert.match(run(['uuid', '--no-newline']).stdout, /^[0-9a-f-]{36}$/u);
});

test('--json emits structured data', () => {
  const { stdout } = run(['hex', '--bytes', '4', '--json']);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.generator, 'hex');
  assert.match(parsed.value, /^[0-9a-f]{8}$/u);
  assert.equal(parsed.entropyBits, 32);

  const many = JSON.parse(run(['uuid', '--count', '2', '--json']).stdout);
  assert.ok(Array.isArray(many));
  assert.equal(many.length, 2);
  assert.equal(many[0].version, 4);
});

test('--env prints NAME=value', () => {
  const { stdout } = run(['hex', '--bytes', '4', '--env', 'SECRET']);
  assert.match(stdout.trim(), /^SECRET=[0-9a-f]{8}$/u);
  const multiple = run(['hex', '--bytes', '4', '--count', '2', '--env', 'SECRET']).stdout.trim().split('\n');
  assert.match(multiple[0], /^SECRET_1=/u);
  assert.match(multiple[1], /^SECRET_2=/u);
});

test('--prefix and --suffix wrap the value', () => {
  const { stdout } = run(['hex', '--bytes', '2', '--prefix', 'x-', '--suffix', '-y']);
  assert.match(stdout.trim(), /^x-[0-9a-f]{4}-y$/u);
});

test('--entropy reports bits on stderr without touching stdout', () => {
  const { stdout, stderr } = run(['hex', '--bytes', '32', '--entropy']);
  assert.match(stdout.trim(), /^[0-9a-f]{64}$/u);
  assert.match(stderr, /entropy: 256 bits/u);
  const multiple = run(['nanoid', '--count', '2', '--entropy']);
  assert.match(multiple.stderr, /126 bits each, 252 bits total/u);
});

test('--copy does not break the command', () => {
  const { status, stdout } = run(['hex', '--bytes', '4', '--copy']);
  assert.equal(status, 0);
  assert.match(stdout.trim(), /^[0-9a-f]{8}$/u);
});

test('unknown command exits 2 with a suggestion', () => {
  const { status, stderr } = run(['uudi']);
  assert.equal(status, 2);
  assert.match(stderr, /unknown command "uudi"/u);
  assert.match(stderr, /did you mean "mint uuid"/u);
});

test('unknown flag exits 2 with a suggestion', () => {
  const { status, stderr } = run(['uuid', '--lenth', '8']);
  assert.equal(status, 2);
  assert.match(stderr, /unknown flag --lenth/u);
  assert.match(stderr, /--length/u);
});

test('flags that a generator does not support are rejected', () => {
  const { status, stderr } = run(['uuid', '--charset', 'abc']);
  assert.equal(status, 2);
  assert.match(stderr, /--charset is not supported by "mint uuid"/u);
});

test('bad sizes exit 2 with a friendly message', () => {
  const { status, stderr } = run(['hex', '--bytes', 'abc']);
  assert.equal(status, 2);
  assert.match(stderr, /--bytes expects a positive integer/u);
  assert.equal(run(['hex', '--bytes', '0']).status, 2);
  assert.equal(run(['hex', '--length', '2000000']).status, 2);
});

test('contradictory size flags are rejected', () => {
  assert.match(run(['hex', '--bytes', '8', '--bits', '64']).stderr, /only one of/u);
  assert.match(run(['hex', '--length', '8', '--bytes', '8']).stderr, /only one of/u);
  assert.match(run(['32', '--bytes', '4']).stderr, /already sets the size/u);
});

test('unexpected positional arguments are rejected', () => {
  const { status, stderr } = run(['uuid', 'oops']);
  assert.equal(status, 2);
  assert.match(stderr, /does not take arguments/u);
});

test('bad dice notation points at mint dice', () => {
  const { status, stderr } = run(['2d6']);
  assert.equal(status, 2);
  assert.match(stderr, /does not look like a size/u);
  assert.match(stderr, /mint dice 2d6/u);
});

test('colors are off when the output is not a terminal', () => {
  assert.doesNotMatch(run(['--help'], { NO_COLOR: '' }).stdout, /\u001b\[/u);
  assert.doesNotMatch(run(['uuid', 'oops']).stderr, /\u001b\[/u);
});

test('NO_COLOR disables colors even on a forced color terminal', () => {
  const { stdout } = run(['--help'], { FORCE_COLOR: '1', NO_COLOR: '1' });
  assert.doesNotMatch(stdout, /\u001b\[/u);
});

test('a handful of commands produce stable shapes end to end', () => {
  const cases: Array<[string[], RegExp]> = [
    [['uuid'], /^[0-9a-f-]{36}$/u],
    [['ulid'], /^[0-9A-HJKMNP-TV-Z]{26}$/u],
    [['ksuid'], /^[0-9A-Za-z]{27}$/u],
    [['nanoid'], /^[A-Za-z0-9_-]{21}$/u],
    [['typeid', 'user'], /^user_[0-9a-hjkmnp-tv-z]{26}$/u],
    [['passphrase', '--words', '4'], /^([a-z]+-){3}[a-z]+$/u],
    [['pin', '--length', '8'], /^\d{8}$/u],
    [['mac'], /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/u],
    [['dice', '3d6'], /^\d{1,2}$/u],
    [['coin'], /^(heads|tails)$/u],
    [['shuffle', 'a', 'b', 'c'], /^[abc]\n[abc]\n[abc]$/u],
    [['pick', 'a', 'b', 'c'], /^[abc]$/u],
    [['apikey'], /^sk_live_[A-Za-z0-9]{32}$/u],
    [['webhook-secret'], /^whsec_[A-Za-z0-9+/=]+$/u],
    [['jwt-secret', '--algo', 'hs512'], /^[A-Za-z0-9_-]{86}$/u],
  ];
  for (const [args, pattern] of cases) {
    const { status, stdout } = run(args);
    assert.equal(status, 0, `${args.join(' ')} exited with ${status}`);
    assert.match(stdout.trim(), pattern, `${args.join(' ')} produced ${stdout.trim()}`);
  }
});
