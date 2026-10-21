import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { cliPath, makeTempTree, type TempTree } from './guard-fixtures.js';

function git(args: string[], cwd: string) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
}

function gitAvailable(): boolean {
  const result = spawnSync('git', ['--version'], { encoding: 'utf8', windowsHide: true });
  return result.error === undefined && result.status === 0;
}

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [cliPath(), ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, NO_COLOR: '1' },
  });
}

function initRepo(tree: TempTree): void {
  git(['init', '-q', '-b', 'main'], tree.dir);
  git(['config', 'user.email', 'guard@example.com'], tree.dir);
  git(['config', 'user.name', 'Guard Test'], tree.dir);
  git(['config', 'commit.gpgsign', 'false'], tree.dir);
}

const GITHUB_TOKEN = `ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'}`;
const STRIPE_KEY = `sk_live_${'a1B2c3D4e5F6g7H8i9J0k1L2'}`;

test('staged scan only reports what is in the index', (context) => {
  if (!gitAvailable()) {
    context.skip('git is not available');
    return;
  }
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  initRepo(tree);

  tree.write('committed.js', `const token = '${GITHUB_TOKEN}';\n`);
  git(['add', '.'], tree.dir);
  git(['commit', '-q', '-m', 'add committed secret'], tree.dir);

  tree.write('staged.js', `stripe.key = '${STRIPE_KEY}';\n`);
  tree.write('clean.js', 'export const value = 1;\n');
  git(['add', '.'], tree.dir);

  const result = runCli(['guard', 'scan', '--staged', '--format', 'json'], tree.dir);
  assert.equal(result.status, 1, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0].file, 'staged.js');
  assert.equal(parsed.findings[0].line, 1);
  assert.equal(parsed.findings[0].rule, 'stripe-secret-key');
  assert.equal(parsed.findings[0].source, 'staged');
  assert.ok(!result.stdout.includes(GITHUB_TOKEN), 'committed secrets must not appear in a staged scan');
});

test('staged scan is clean when only safe changes are staged', (context) => {
  if (!gitAvailable()) {
    context.skip('git is not available');
    return;
  }
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  initRepo(tree);
  tree.write('index.js', 'export const answer = 42;\n');
  git(['add', '.'], tree.dir);

  const result = runCli(['guard', 'scan', '--staged'], tree.dir);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /nothing leaked/u);
});

test('history scan reports the introducing commit, author and date', (context) => {
  if (!gitAvailable()) {
    context.skip('git is not available');
    return;
  }
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  initRepo(tree);

  tree.write('config.js', `const token = '${GITHUB_TOKEN}';\n`);
  git(['add', '.'], tree.dir);
  git(['commit', '-q', '-m', 'introduce token'], tree.dir);
  const introducingCommit = git(['rev-parse', 'HEAD'], tree.dir).stdout.trim();

  tree.write('config.js', 'const token = process.env.GITHUB_TOKEN;\n');
  git(['add', '.'], tree.dir);
  git(['commit', '-q', '-m', 'remove token'], tree.dir);

  const result = runCli(['guard', 'scan', '--history', '--format', 'json'], tree.dir);
  assert.equal(result.status, 1, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.findings.length, 1, JSON.stringify(parsed.findings, null, 2));
  const [finding] = parsed.findings;
  assert.equal(finding.file, 'config.js');
  assert.equal(finding.line, 1);
  assert.equal(finding.source, 'history');
  assert.equal(finding.commit.hash, introducingCommit);
  assert.equal(finding.commit.author, 'Guard Test');
  assert.match(finding.commit.date, /^\d{4}-\d{2}-\d{2}$/u);
  assert.ok(!result.stdout.includes(GITHUB_TOKEN), 'history output must stay redacted');
});

test('history --since limits the range to a revision', (context) => {
  if (!gitAvailable()) {
    context.skip('git is not available');
    return;
  }
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  initRepo(tree);

  tree.write('a.js', `const token = '${GITHUB_TOKEN}';\n`);
  git(['add', '.'], tree.dir);
  git(['commit', '-q', '-m', 'secret'], tree.dir);
  tree.write('a.js', 'export const ok = 1;\n');
  git(['add', '.'], tree.dir);
  git(['commit', '-q', '-m', 'cleanup'], tree.dir);

  const limited = runCli(['guard', 'scan', '--history', '--since', 'HEAD~1', '--format', 'json'], tree.dir);
  assert.equal(limited.status, 0, limited.stderr);
  assert.equal(JSON.parse(limited.stdout).findings.length, 0);

  const sinceDate = runCli(['guard', 'scan', '--history', '--since', '2000-01-01', '--format', 'json'], tree.dir);
  assert.equal(sinceDate.status, 1, sinceDate.stderr);
  assert.equal(JSON.parse(sinceDate.stdout).findings.length, 1);
});

test('scanning a subdirectory reports repository-relative paths', (context) => {
  if (!gitAvailable()) {
    context.skip('git is not available');
    return;
  }
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  initRepo(tree);
  tree.write('apps/web/src/config.ts', `const key = '${STRIPE_KEY}';\n`);
  tree.mkdir('apps/web');

  const result = runCli(['guard', 'scan', 'apps/web', '--format', 'json'], tree.dir);
  assert.equal(result.status, 1, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0].file, 'apps/web/src/config.ts');
});

test('scan --staged outside a git repository fails with exit 2', (context) => {
  if (!gitAvailable()) {
    context.skip('git is not available');
    return;
  }
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  tree.write('file.txt', 'hello');
  const result = runCli(['guard', 'scan', '--staged'], tree.dir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not inside a git repository/u);
});

test('diff mode only reports lines the revision added', (context) => {
  if (!gitAvailable()) {
    context.skip('git is not available');
    return;
  }
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  initRepo(tree);

  tree.write('app.js', 'export const ok = 1;\n');
  git(['add', '.'], tree.dir);
  git(['commit', '-q', '-m', 'base'], tree.dir);

  tree.write('app.js', `export const ok = 1;\nexport const token = '${GITHUB_TOKEN}';\n`);
  tree.write('ignored/leak.js', `const key = '${STRIPE_KEY}';\n`);
  tree.write('.mintguardignore', 'ignored/\n');
  git(['add', '.'], tree.dir);
  git(['commit', '-q', '-m', 'leak'], tree.dir);

  const diff = runCli(['guard', 'scan', '--diff', 'HEAD~1', '--format', 'json'], tree.dir);
  assert.equal(diff.status, 1, diff.stderr);
  const parsed = JSON.parse(diff.stdout);
  assert.equal(parsed.findings.length, 1, JSON.stringify(parsed.findings));
  assert.equal(parsed.findings[0].file, 'app.js');
  assert.equal(parsed.findings[0].line, 2);
  assert.equal(parsed.findings[0].source, 'diff');
  assert.ok(!diff.stdout.includes(GITHUB_TOKEN));

  const empty = runCli(['guard', 'scan', '--diff', 'HEAD', '--format', 'json'], tree.dir);
  assert.equal(empty.status, 0, empty.stdout);

  const bad = runCli(['guard', 'scan', '--diff', '-x'], tree.dir);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /needs a revision/u);
});

test('staged and history scans can be scoped to a directory', (context) => {
  if (!gitAvailable()) {
    context.skip('git is not available');
    return;
  }
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  initRepo(tree);

  tree.write('a/leak.js', `const token = '${GITHUB_TOKEN}';\n`);
  tree.write('b/leak.js', `const key = '${STRIPE_KEY}';\n`);
  git(['add', '.'], tree.dir);

  const stagedA = JSON.parse(runCli(['guard', 'scan', '--staged', 'a', '--format', 'json'], tree.dir).stdout);
  assert.equal(stagedA.findings.length, 1);
  assert.equal(stagedA.findings[0].file, 'a/leak.js');

  const stagedB = JSON.parse(runCli(['guard', 'scan', '--staged', 'b', '--format', 'json'], tree.dir).stdout);
  assert.equal(stagedB.findings.length, 1);
  assert.equal(stagedB.findings[0].file, 'b/leak.js');

  git(['commit', '-q', '-m', 'both'], tree.dir);

  const historyA = JSON.parse(runCli(['guard', 'scan', '--history', 'a', '--format', 'json'], tree.dir).stdout);
  assert.equal(historyA.findings.length, 1);
  assert.equal(historyA.findings[0].file, 'a/leak.js');
});

test('history and diff modes honour .mintguardignore directories', (context) => {
  if (!gitAvailable()) {
    context.skip('git is not available');
    return;
  }
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  initRepo(tree);

  tree.write('.mintguardignore', 'fixtures/\n');
  tree.write('base.txt', 'base\n');
  git(['add', '.'], tree.dir);
  git(['commit', '-q', '-m', 'base'], tree.dir);

  tree.write('src/app.js', `const token = '${GITHUB_TOKEN}';\n`);
  tree.write('fixtures/sample.js', `const key = '${STRIPE_KEY}';\n`);
  git(['add', '.'], tree.dir);
  git(['commit', '-q', '-m', 'commit both'], tree.dir);

  const history = JSON.parse(runCli(['guard', 'scan', '--history', '--format', 'json'], tree.dir).stdout);
  assert.deepEqual(history.findings.map((finding: { file: string }) => finding.file), ['src/app.js']);

  const diff = JSON.parse(runCli(['guard', 'scan', '--diff', 'HEAD~1', '--format', 'json'], tree.dir).stdout);
  assert.deepEqual(diff.findings.map((finding: { file: string }) => finding.file), ['src/app.js']);
});

test('scan --history on an empty repository is clean', (context) => {
  if (!gitAvailable()) {
    context.skip('git is not available');
    return;
  }
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  initRepo(tree);
  tree.write('file.txt', 'hello\n');
  const result = runCli(['guard', 'scan', '--history'], tree.dir);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
