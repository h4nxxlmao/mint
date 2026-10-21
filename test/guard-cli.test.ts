import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cliPath, makeTempTree, type TempTree } from './guard-fixtures.js';

const GITHUB_TOKEN = `ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'}`;
const STRIPE_KEY = `sk_live_${'a1B2c3D4e5F6g7H8i9J0k1L2'}`;
const PASSWORD = 'Xk9mQ2pL7wR4vT8nB3cF6hJ1';

function run(args: string[], cwd?: string) {
  const result = spawnSync(process.execPath, [cliPath(), ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, NO_COLOR: '1' },
  });
  return { status: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function plantedTree(context: { after(fn: () => void): void }): TempTree {
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  tree.write(
    'src/config.ts',
    [
      `export const github = '${GITHUB_TOKEN}';`,
      `stripe.secret = '${STRIPE_KEY}';`,
      `const dbPassword = '${PASSWORD}';`,
      `const safe = 'process.env.API_KEY';`,
    ].join('\n'),
  );
  return tree;
}

function gitAvailable(): boolean {
  const result = spawnSync('git', ['--version'], { encoding: 'utf8', windowsHide: true });
  return result.error === undefined && result.status === 0;
}

test('guard help screens list every command', () => {
  const bare = run(['guard']);
  assert.equal(bare.status, 0);
  assert.match(bare.stdout, /mint guard/u);
  assert.match(bare.stdout, /scan/u);
  assert.match(bare.stdout, /rotate-help/u);
  assert.match(bare.stdout, /generate with mint, protect with mint guard/u);

  assert.equal(run(['guard', '--help']).stdout, bare.stdout);
  assert.equal(run(['help', 'guard']).stdout, bare.stdout);

  const scanHelp = run(['guard', 'scan', '--help']);
  assert.equal(scanHelp.status, 0);
  assert.match(scanHelp.stdout, /mint guard scan/u);
  assert.match(scanHelp.stdout, /--staged/u);
  assert.match(scanHelp.stdout, /--history/u);

  assert.equal(run(['guard', 'help', 'scan']).stdout, scanHelp.stdout);
});

test('the main help advertises the guard', () => {
  const help = run(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /protect/u);
  assert.match(help.stdout, /mint guard scan --staged/u);
  assert.match(help.stdout, /generate with mint, protect with mint guard/u);
});

test('unknown guard commands and unsupported flags exit 2', () => {
  const unknown = run(['guard', 'scna']);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /unknown guard command "scna"/u);
  assert.match(unknown.stderr, /did you mean "mint guard scan"/u);

  const unsupported = run(['guard', 'scan', '--count', '3']);
  assert.equal(unsupported.status, 2);
  assert.match(unsupported.stderr, /--count is not supported by "mint guard scan"/u);

  assert.equal(run(['guard', 'rotate-help']).status, 2);
  assert.equal(run(['guard', 'scan', '--entropy-threshold', 'nope']).status, 2);
});

test('scan reports findings with redacted previews, reasons and fixes', (context) => {
  const tree = plantedTree(context);
  const result = run(['guard', 'scan', tree.dir]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /github-token/u);
  assert.match(result.stdout, /stripe-secret-key/u);
  assert.match(result.stdout, /src\/config\.ts:\d+/u);
  assert.match(result.stdout, /rotate the exposed secret first/u);
  assert.match(result.stdout, /mint token --bytes 32/u);
  assert.match(result.stdout, /preview:/u);
  assert.match(result.stdout, /why:/u);

  assert.ok(!result.stdout.includes(GITHUB_TOKEN), 'text report leaked the github token');
  assert.ok(!result.stdout.includes(STRIPE_KEY), 'text report leaked the stripe key');
  assert.ok(!result.stdout.includes(PASSWORD), 'text report leaked the password');
  assert.ok(!result.stderr.includes(GITHUB_TOKEN));
});

test('every output format stays redacted', (context) => {
  const tree = plantedTree(context);
  for (const format of ['text', 'json', 'sarif', 'markdown']) {
    const result = run(['guard', 'scan', tree.dir, '--format', format]);
    assert.equal(result.status, 1, `${format} exit`);
    assert.ok(result.stdout.length > 0, `${format} was empty`);
    for (const secret of [GITHUB_TOKEN, STRIPE_KEY, PASSWORD]) {
      assert.ok(!result.stdout.includes(secret), `${format} leaked a secret`);
    }
  }
});

test('json and sarif are machine readable', (context) => {
  const tree = plantedTree(context);
  const json = JSON.parse(run(['guard', 'scan', tree.dir, '--json']).stdout);
  assert.equal(json.tool, 'mint guard');
  assert.equal(json.summary.total, json.findings.length);
  for (const finding of json.findings) {
    assert.ok(finding.id);
    assert.ok(finding.hash);
    assert.ok(finding.rule);
    assert.ok(finding.preview);
    assert.ok(finding.mintCommand);
    assert.ok(!finding.raw);
  }

  const sarif = JSON.parse(run(['guard', 'scan', tree.dir, '--format', 'sarif']).stdout);
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs[0].tool.driver.name, 'mint guard');
  assert.equal(sarif.runs[0].results.length, json.findings.length);
  for (const result of sarif.runs[0].results) {
    assert.ok(['error', 'warning', 'note'].includes(result.level));
    assert.ok(result.locations[0].physicalLocation.artifactLocation.uri.endsWith('.ts'));
    assert.ok(result.partialFingerprints.mintGuardHash);
  }
});

test('markdown report has a table and a remediation section', (context) => {
  const tree = plantedTree(context);
  const markdown = run(['guard', 'scan', tree.dir, '--format', 'markdown']).stdout;
  assert.match(markdown, /^\| Severity \| Rule \| Location \| Preview \| Replacement \|$/mu);
  assert.match(markdown, /## Next steps/u);
  assert.match(markdown, /Rotate the exposed secret first/u);
});

test('exit codes follow --fail-on', (context) => {
  const tree = plantedTree(context);
  assert.equal(run(['guard', 'scan', tree.dir, '--fail-on', 'critical']).status, 1);
  assert.equal(run(['guard', 'scan', tree.dir, '--fail-on', 'low']).status, 1);
  assert.equal(run(['guard', 'scan', tree.dir, '--fail-on', 'nonsense']).status, 2);

  const mediumOnly = makeTempTree();
  context.after(() => mediumOnly.cleanup());
  mediumOnly.write('src/app.ts', `password = '${PASSWORD}';\n`);
  assert.equal(run(['guard', 'scan', mediumOnly.dir, '--fail-on', 'critical']).status, 0);
  assert.equal(run(['guard', 'scan', mediumOnly.dir, '--fail-on', 'medium']).status, 1);
});

test('a clean tree exits 0', (context) => {
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  tree.write('src/index.ts', 'export const answer = 42;\nexport const name = "mint";\n');
  const result = run(['guard', 'scan', tree.dir]);
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /no findings - nothing leaked/u);
});

test('.mintguardignore and inline comments suppress findings', (context) => {
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  tree.write('ignored/config.ts', `const token = '${GITHUB_TOKEN}';\n`);
  tree.write('src/inline.ts', [
    `const a = '${GITHUB_TOKEN}'; // mintguard:ignore`,
    '// mintguard:ignore-next-line',
    `const b = '${STRIPE_KEY}';`,
  ].join('\n'));
  tree.write('.mintguardignore', 'ignored/\n');

  const result = run(['guard', 'scan', tree.dir, '--format', 'json']);
  assert.equal(result.status, 0, result.stdout);
  assert.equal(JSON.parse(result.stdout).findings.length, 0);
});

test('config can disable rules and add custom ones', (context) => {
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  tree.write('.mintguard.json', JSON.stringify({
    disabledRules: ['github-token'],
    customRules: [{ id: 'internal-key', name: 'Internal key', regex: 'INTERNAL_[A-Za-z0-9]{10,}', severity: 'critical' }],
  }));
  tree.write('src/app.ts', [
    `const gh = '${GITHUB_TOKEN}';`,
    `const internal = 'INTERNAL_Qm7Zx2Lp9Rt4';`,
  ].join('\n'));

  const parsed = JSON.parse(run(['guard', 'scan', tree.dir, '--format', 'json']).stdout);
  assert.equal(parsed.findings.filter((finding: { rule: string }) => finding.rule === 'github-token').length, 0);
  assert.equal(parsed.findings.filter((finding: { rule: string }) => finding.rule === 'internal-key').length, 1);
});

test('--rules limits the scan to specific rule ids', (context) => {
  const tree = plantedTree(context);
  const parsed = JSON.parse(run(['guard', 'scan', tree.dir, '--rules', 'github-token', '--format', 'json']).stdout);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0].rule, 'github-token');
  assert.equal(run(['guard', 'scan', tree.dir, '--rules', 'nope']).status, 2);
});

test('--max-file-size skips big files', (context) => {
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  tree.write('big.ts', `const token = '${GITHUB_TOKEN}';\n${'// filler\n'.repeat(200)}`);
  assert.equal(run(['guard', 'scan', tree.dir, '--format', 'json']).status, 1);
  const skipped = run(['guard', 'scan', tree.dir, '--max-file-size', '1kb', '--format', 'json']);
  assert.equal(skipped.status, 0, skipped.stdout);
  assert.equal(JSON.parse(skipped.stdout).stats.oversized, 1);
});

test('--entropy-threshold tunes unknown-secret detection', (context) => {
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  tree.write('src/session.ts', `const session = 'Qm7Zx2Lp9Rt4Vb8Nc1Md6Kf3Hg5Js0Da';\n`);
  assert.equal(run(['guard', 'scan', tree.dir, '--format', 'json']).status, 1);
  const strict = run(['guard', 'scan', tree.dir, '--entropy-threshold', '7', '--format', 'json']);
  assert.equal(strict.status, 0, strict.stdout);
});

test('baseline hides known findings and only new leaks fail', (context) => {
  const tree = plantedTree(context);
  const baseline = run(['guard', 'baseline', tree.dir]);
  assert.equal(baseline.status, 0, baseline.stderr);
  assert.match(baseline.stdout, /wrote \d+ finding hashes/u);

  const rescan = run(['guard', 'scan', tree.dir, '--format', 'json']);
  assert.equal(rescan.status, 0, rescan.stdout);
  const parsed = JSON.parse(rescan.stdout);
  assert.equal(parsed.findings.length, 0);
  assert.ok(parsed.summary.baselined > 0);

  tree.write('src/new.ts', `const fresh = '${STRIPE_KEY}';\n`);
  const after = run(['guard', 'scan', tree.dir, '--format', 'json']);
  assert.equal(after.status, 1);
  assert.equal(JSON.parse(after.stdout).findings.length, 1);

  const ignoredBaseline = run(['guard', 'scan', tree.dir, '--no-baseline', '--format', 'json']);
  const withoutBaseline = JSON.parse(ignoredBaseline.stdout);
  assert.ok(withoutBaseline.findings.length > 1);
  assert.ok(
    withoutBaseline.findings.every((finding: { file: string }) => finding.file !== '.mintguard-baseline.json'),
    'the baseline file itself must never be reported',
  );
});

test('init creates the config and ignore files without clobbering', (context) => {
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  const first = run(['guard', 'init', tree.dir]);
  assert.equal(first.status, 0);
  assert.match(first.stdout, /created/u);

  const config = JSON.parse(spawnSync('node', ['-e', 'process.stdout.write(require("fs").readFileSync(process.argv[1],"utf8"))', join(tree.dir, '.mintguard.json')], { encoding: 'utf8' }).stdout);
  assert.equal(config.failOn, 'medium');
  assert.equal(config.version, 1);

  const again = run(['guard', 'init', tree.dir]);
  assert.match(again.stdout, /kept/u);

  const forced = run(['guard', 'init', tree.dir, '--force']);
  assert.match(forced.stdout, /replaced/u);
});

test('env checks tracked, unignored and missing example files', (context) => {
  if (!gitAvailable()) {
    context.skip('git is not available');
    return;
  }
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: tree.dir, windowsHide: true });
  tree.write('.env', `API_KEY=${'Qm7Zx2Lp9Rt4Vb8Nc1Md6Kf3Hg5Js0Da'}\n`);
  tree.write('.env.local', 'API_KEY=changeme\n');

  const missingExample = run(['guard', 'env', tree.dir, '--format', 'json']);
  assert.equal(missingExample.status, 1);
  const parsed = JSON.parse(missingExample.stdout);
  assert.ok(parsed.findings.some((finding: { rule: string }) => finding.rule === 'env-file-not-ignored'));
  assert.ok(parsed.findings.some((finding: { rule: string }) => finding.rule === 'env-no-example'));

  tree.write('.gitignore', '.env*\n!.env.example\n');
  tree.write('.env.example', 'API_KEY=your-api-key-here\n');
  const healthy = run(['guard', 'env', tree.dir, '--format', 'json']);
  assert.equal(healthy.status, 0, healthy.stdout);
  assert.equal(JSON.parse(healthy.stdout).findings.length, 0);
});

test('rotate-help resolves rules and finding ids', () => {
  const byRule = run(['guard', 'rotate-help', 'aws-access-key-id']);
  assert.equal(byRule.status, 0);
  assert.match(byRule.stdout, /AWS/u);
  assert.match(byRule.stdout, /rotate it/u);
  assert.match(byRule.stdout, /mint base64url --length 40/u);
  assert.match(byRule.stdout, /IAM/u);

  const byFinding = run(['guard', 'rotate-help', 'stripe-secret-key-1a2b3c4d']);
  assert.equal(byFinding.status, 0);
  assert.match(byFinding.stdout, /Stripe/u);

  const unknown = run(['guard', 'rotate-help', 'not-a-rule']);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /unknown finding or rule/u);
});

test('rules lists ids, severities and replacements', () => {
  const text = run(['guard', 'rules']);
  assert.equal(text.status, 0);
  assert.match(text.stdout, /private-key-block/u);
  assert.match(text.stdout, /critical/u);

  const json = JSON.parse(run(['guard', 'rules', '--format', 'json']).stdout);
  assert.ok(json.rules.length >= 30);
  assert.ok(json.rules.every((rule: { id: string; mintCommand: string }) => rule.id && rule.mintCommand.startsWith('mint ')));
});

test('--fix prints the remediation plan without touching files', (context) => {
  const tree = plantedTree(context);
  const before = spawnSync('node', ['-e', 'process.stdout.write(require("fs").readFileSync(process.argv[1],"utf8"))', join(tree.dir, 'src', 'config.ts')], { encoding: 'utf8' }).stdout;
  const result = run(['guard', 'scan', tree.dir, '--fix']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /fix plan/u);
  assert.match(result.stdout, /git filter-repo/u);
  const after = spawnSync('node', ['-e', 'process.stdout.write(require("fs").readFileSync(process.argv[1],"utf8"))', join(tree.dir, 'src', 'config.ts')], { encoding: 'utf8' }).stdout;
  assert.equal(before, after, '--fix must never edit files');
});

test('the committed clean fixture scans clean', () => {
  const fixture = fileURLToPath(new URL('../../test/fixtures/guard/clean-project', import.meta.url));
  const result = run(['guard', 'scan', fixture, '--format', 'json']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.findings.length, 0);
  assert.ok(parsed.stats.filesScanned > 0, 'the fixture should actually be scanned');
});

test('install-hook and uninstall-hook manage a pre-commit hook', (context) => {
  if (!gitAvailable()) {
    context.skip('git is not available');
    return;
  }
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: tree.dir, windowsHide: true });

  const install = run(['guard', 'install-hook', tree.dir]);
  assert.equal(install.status, 0, install.stderr);
  const hookPath = join(tree.dir, '.git', 'hooks', 'pre-commit');
  const hook = spawnSync('node', ['-e', 'process.stdout.write(require("fs").readFileSync(process.argv[1],"utf8"))', hookPath], { encoding: 'utf8' }).stdout;
  assert.match(hook, /# >>> mint guard >>>/u);
  assert.match(hook, /guard scan --staged --fail-on "?\$?guard_fail_on"?/u);
  assert.match(hook, /# <<< mint guard <<</u);

  const noClobber = run(['guard', 'install-hook', tree.dir]);
  assert.equal(noClobber.status, 0);

  const uninstall = run(['guard', 'uninstall-hook', tree.dir]);
  assert.equal(uninstall.status, 0);
  assert.match(uninstall.stdout, /removed/u);
  assert.equal(run(['guard', 'uninstall-hook', tree.dir]).stdout.includes('no pre-commit hook'), true);
});

test('a pre-commit hook blocks a commit containing a secret', (context) => {
  if (!gitAvailable()) {
    context.skip('git is not available');
    return;
  }
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  const git = (args: string[], env = {}) => spawnSync('git', args, { cwd: tree.dir, encoding: 'utf8', windowsHide: true, env: { ...process.env, ...env } });
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 'guard@example.com']);
  git(['config', 'user.name', 'Guard Test']);
  git(['config', 'commit.gpgsign', 'false']);

  const install = run(['guard', 'install-hook', tree.dir]);
  assert.equal(install.status, 0, install.stderr);

  // A shim so the hook's `mint` resolves to this build instead of a global install.
  const shimDir = tree.mkdir('shim');
  const nodePath = process.execPath.replace(/\\/gu, '/');
  const cli = cliPath().replace(/\\/gu, '/');
  const shimPath = join(shimDir, 'mint');
  writeFileSync(shimPath, `#!/bin/sh\nexec "${nodePath}" "${cli}" "$@"\n`);
  chmodSync(shimPath, 0o755);

  tree.write('leak.js', `const token = '${GITHUB_TOKEN}';\n`);
  git(['add', '.']);
  const blocked = git(['commit', '-m', 'should fail'], { PATH: `${shimDir}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}` });
  assert.notEqual(blocked.status, 0, 'commit should have been blocked');
  assert.match(`${blocked.stdout}${blocked.stderr}`, /mint guard: commit blocked/u);

  const uninstall = run(['guard', 'uninstall-hook', tree.dir]);
  assert.equal(uninstall.status, 0);
  const allowed = git(['commit', '-m', 'without hook'], { PATH: `${shimDir}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}` });
  assert.equal(allowed.status, 0, `${allowed.stdout}${allowed.stderr}`);
});
