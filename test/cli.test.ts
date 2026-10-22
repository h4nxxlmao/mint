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

test('multi-line values are decorated line by line', () => {
  const env = run(['pick', 'a', 'b', 'c', '--count', '2', '--env', 'CHOICE']).stdout.trim().split('\n');
  assert.equal(env.length, 2);
  assert.match(env[0], /^CHOICE_1=[abc]$/u);
  assert.match(env[1], /^CHOICE_2=[abc]$/u);

  const suffixed = run(['shuffle', 'a', 'b', 'c', '--suffix', '!']).stdout.trim().split('\n');
  assert.equal(suffixed.length, 3);
  for (const line of suffixed) assert.match(line, /^[abc]!$/u);

  const prefixed = run(['shuffle', 'a', 'b', '--prefix', '>']).stdout.trim().split('\n');
  assert.equal(prefixed.length, 2);
  for (const line of prefixed) assert.match(line, /^>[ab]$/u);
});

test('a numeric shorthand that is out of range is explained', () => {
  const zero = run(['0']);
  assert.equal(zero.status, 2);
  assert.match(zero.stderr, /at least 1/u);
  assert.doesNotMatch(zero.stderr, /does not look like a size/u);
});

test('list prints the catalog as text and json', () => {
  const text = run(['list']);
  assert.equal(text.status, 0);
  assert.match(text.stdout, /uuid/u);
  assert.match(text.stdout, /guard/u);
  assert.match(text.stdout, /completions/u);

  const catalog = JSON.parse(run(['list', '--json']).stdout);
  assert.ok(catalog.generators.length >= 40, `only ${catalog.generators.length} generators`);
  assert.ok(catalog.guard.length >= 9);
  assert.equal(catalog.tools.length, 3);
  assert.ok(catalog.generators.every((entry: { name: string; summary: string }) => entry.name && entry.summary));
  assert.equal(run(['list', '--format', 'nope']).status, 2);
});

test('completions cover every supported shell', () => {
  for (const shell of ['bash', 'zsh', 'fish', 'powershell']) {
    const result = run(['completions', shell]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /uuid/u);
    assert.match(result.stdout, /guard/u);
    assert.match(result.stdout, /rotate-help/u);
  }
  assert.equal(run(['completions']).status, 2);
  const unknown = run(['completions', 'tcsh']);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /unknown shell/u);
});

test('doctor reports the environment', () => {
  const text = run(['doctor']);
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /csprng/u);
  assert.match(text.stdout, /node/u);
  assert.match(text.stdout, /everything mint needs is available|required check/u);

  const json = JSON.parse(run(['doctor', '--json']).stdout);
  assert.equal(json.ok, true);
  assert.ok(json.checks.some((check: { name: string; status: string }) => check.name === 'csprng' && check.status === 'ok'));
  assert.ok(json.checks.some((check: { name: string }) => check.name === 'git'));
});

test('help works for the tool commands', () => {
  const help = run(['help', 'list']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /mint list/u);
  assert.match(help.stdout, /--json/u);
  assert.match(run(['help', 'completions']).stdout, /bash/u);
  assert.match(run(['help', 'doctor']).stdout, /CSPRNG/u);
});

test('--raw writes the bytes themselves', () => {
  const raw = spawnSync(process.execPath, [CLI, '32', '--raw'], {
    env: { ...process.env, NO_COLOR: '1' },
    windowsHide: true,
  });
  assert.equal(raw.status, 0);
  assert.equal(raw.stdout.length, 32);

  const sixteen = spawnSync(process.execPath, [CLI, '16', '--raw'], { windowsHide: true });
  assert.equal(sixteen.stdout.length, 16);
  assert.notEqual(raw.stdout.toString('hex'), sixteen.stdout.toString('hex'));

  const withEntropy = spawnSync(process.execPath, [CLI, '8', '--raw', '--entropy'], { windowsHide: true });
  assert.equal(withEntropy.stdout.length, 8);
  assert.match(String(withEntropy.stderr), /entropy: 64 bits/u);

  const conflict = run(['32', '--raw', '--json']);
  assert.equal(conflict.status, 2);
  assert.match(conflict.stderr, /--raw cannot be combined with --json/u);
});

test('--raw rejects character-sized output', () => {
  const result = run(['hex', '--length', '16', '--raw']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /byte-based size/u);
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
