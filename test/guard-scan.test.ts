import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { defaultConfig, loadConfig, resolveRules } from '../src/guard/config.js';
import { ENTROPY_RULE, RULES } from '../src/guard/rules.js';
import { Scanner, eligibleRules, fileMarkers } from '../src/guard/scan.js';
import type { ScanOptions } from '../src/guard/scan.js';
import type { Rule } from '../src/guard/types.js';
import { makeTempTree } from './guard-fixtures.js';

const ENTROPY = { threshold: 4.5, minLength: 20, maxLength: 200 };

function options(overrides: Partial<ScanOptions> = {}): ScanOptions {
  return {
    rules: RULES,
    entropyRule: undefined,
    entropy: ENTROPY,
    salt: 'salt',
    baselineIds: new Set(),
    inlineComments: true,
    maxFindings: 100,
    ...overrides,
  };
}

function scanContent(scanner: Scanner, content: string, markers: ReadonlySet<string> | null = null) {
  scanner.scanContent(content, { file: 'src/app.ts', source: 'worktree' }, markers);
  return scanner.outcome();
}

test('scanner reports the line number of each finding', () => {
  const content = ['const a = 1;', '', 'const token = "ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8";'].join('\n');
  const outcome = scanContent(new Scanner(options()), content);
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0].line, 3);
  assert.equal(outcome.findings[0].file, 'src/app.ts');
});

test('inline ignore suppresses the whole line', () => {
  const content = [
    `const a = 'ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'}'; // mintguard:ignore`,
    `const b = 'ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'}';`,
  ].join('\n');
  const outcome = scanContent(new Scanner(options()), content);
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0].line, 2);
});

test('ignore-next-line suppresses the following line only', () => {
  const content = [
    '// mintguard:ignore-next-line',
    `const a = 'ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'}';`,
    `const b = 'ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'}';`,
  ].join('\n');
  const outcome = scanContent(new Scanner(options()), content);
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0].line, 3);
});

test('inline ignore can be scoped to one rule', () => {
  const content = [
    `const a = 'ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'}'; // mintguard:ignore github-token`,
    `const b = 'ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'}'; // mintguard:ignore stripe-secret-key`,
  ].join('\n');
  const outcome = scanContent(new Scanner(options()), content);
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0].line, 2);
});

test('inline comments can be disabled', () => {
  const content = `const a = 'ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'}'; // mintguard:ignore`;
  const outcome = scanContent(new Scanner(options({ inlineComments: false })), content);
  assert.equal(outcome.findings.length, 1);
});

test('the same value is reported once, at the highest severity', () => {
  const duplicate: Rule = {
    id: 'custom-critical',
    name: 'Critical duplicate',
    regex: String.raw`value = '([A-Za-z0-9]{20,})'`,
    capture: 1,
    severity: 'critical',
    why: 'Duplicate rule used to check span dedupe.',
    mintCommand: 'mint token',
    rotation: 'generic',
  };
  const low = { ...duplicate, id: 'custom-low', severity: 'low' as const };
  const scanner = new Scanner(options({ rules: [low, duplicate] }));
  const outcome = scanContent(scanner, `value = '${'Qm7Zx2Lp9Rt4Vb8Nc1Md6Kf3Hg5Js0Da'}'`);
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0].severity, 'critical');
});

test('maxFindings truncates and flags the outcome', () => {
  const lines = Array.from({ length: 6 }, (_, index) => `const k${index} = 'ghp_${`a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R${index}`}';`);
  const outcome = scanContent(new Scanner(options({ maxFindings: 2 })), lines.join('\n'));
  assert.equal(outcome.findings.length, 2);
  assert.equal(outcome.truncated, true);
});

test('very long lines are skipped and counted', () => {
  const longLine = `const token = 'ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'}';${'x'.repeat(9000)}`;
  const outcome = scanContent(new Scanner(options()), longLine);
  assert.equal(outcome.findings.length, 0);
  assert.equal(outcome.longLinesSkipped, 1);
});

test('entropy detection can be enabled and disabled', () => {
  const content = `const session = 'Qm7Zx2Lp9Rt4Vb8Nc1Md6Kf3Hg5Js0Da';`;
  assert.equal(scanContent(new Scanner(options()), content).findings.length, 0);
  const withEntropy = scanContent(new Scanner(options({ entropyRule: ENTROPY_RULE })), content);
  assert.equal(withEntropy.findings.length, 1);
  assert.equal(withEntropy.findings[0].ruleId, 'entropy-string');
});

test('variable references and member access are not hard-coded credentials', () => {
  const content = [
    'const fields = { privateKey: privatePem, publicKey: publicPem };',
    'const apiKey = config.apiKey;',
    "password = 'hunter2hunter2';",
  ].join('\n');
  const outcome = scanContent(new Scanner(options()), content);
  assert.equal(outcome.findings.length, 1, outcome.findings.map((finding) => finding.ruleId).join(', '));
  assert.equal(outcome.findings[0].line, 3);
  assert.equal(outcome.findings[0].ruleId, 'generic-assignment');
});

test('baseline matches are counted but not listed', () => {
  const content = `const token = 'ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'}';`;
  const first = scanContent(new Scanner(options()), content);
  const hash = first.findings[0].hash;
  const outcome = scanContent(new Scanner(options({ baselineIds: new Set([hash]) })), content);
  assert.equal(outcome.findings.length, 0);
  assert.equal(outcome.baselined, 1);
});

test('whole-file rules only run when their markers are present', () => {
  const rule = RULES.find((item) => item.id === 'supabase-service-role')!;
  const jwtLine = `KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.${'Qm7Zx2Lp9Rt4Vb8Nc1Md6Kf3Hg5Js0Da'}`;

  const withoutMarker = scanContent(new Scanner(options({ rules: [rule] })), jwtLine, fileMarkers(jwtLine, [rule]));
  assert.equal(withoutMarker.findings.length, 0);

  const content = `${jwtLine}\nconst role = 'service_role';`;
  const withMarker = scanContent(new Scanner(options({ rules: [rule] })), content, fileMarkers(content, [rule]));
  assert.equal(withMarker.findings.length, 1);

  assert.equal(eligibleRules([rule], null).length, 0, 'history mode skips whole-file rules');
  assert.equal(eligibleRules([rule], new Set([rule.id])).length, 1);
});

test('config defaults are complete', () => {
  const config = defaultConfig();
  assert.equal(config.failOn, 'medium');
  assert.equal(config.entropyThreshold, 4.5);
  assert.equal(config.maxFileSize, 1024 * 1024);
  assert.equal(config.includeLockfiles, false);
  assert.deepEqual(config.disabledRules, []);
  assert.deepEqual(config.customRules, []);
});

test('config loading validates fields and merges defaults', (context) => {
  const tree = makeTempTree();
  context.after(() => tree.cleanup());

  tree.write('.mintguard.json', JSON.stringify({ failOn: 'high', entropyThreshold: 5.2, disabledRules: ['jwt'] }));
  const config = loadConfig(tree.dir);
  assert.equal(config.failOn, 'high');
  assert.equal(config.entropyThreshold, 5.2);
  assert.deepEqual(config.disabledRules, ['jwt']);
  assert.equal(config.maxFileSize, 1024 * 1024);
  assert.ok(config.path?.endsWith('.mintguard.json'));
});

test('invalid config files produce friendly usage errors', (context) => {
  const tree = makeTempTree();
  context.after(() => tree.cleanup());

  tree.write('.mintguard.json', '{ not json');
  assert.throws(() => loadConfig(tree.dir), /not valid JSON/u);

  tree.write('.mintguard.json', JSON.stringify({ failOn: 'sometimes' }));
  assert.throws(() => loadConfig(tree.dir), /failOn/u);

  tree.write('.mintguard.json', JSON.stringify({ customRules: [{ id: 'x', regex: '(' }] }));
  assert.throws(() => loadConfig(tree.dir), /invalid regex/u);
});

test('missing config file falls back to defaults but an explicit path must exist', (context) => {
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  assert.equal(loadConfig(tree.dir).failOn, 'medium');
  assert.throws(() => loadConfig(tree.dir, 'nope.json'), /not found/u);
});

test('rule resolution applies disables, severity overrides and custom rules', (context) => {
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  tree.write(
    '.mintguard.json',
    JSON.stringify({
      disabledRules: ['jwt'],
      rules: { 'generic-assignment': { severity: 'critical' }, 'entropy-string': { severity: 'low' } },
      customRules: [{ id: 'internal', regex: 'INTERNAL_[A-Za-z0-9]{10,}', severity: 'high' }],
    }),
  );
  const config = loadConfig(tree.dir);
  const resolved = resolveRules(config);
  assert.ok(!resolved.some((rule) => rule.id === 'jwt'));
  assert.equal(resolved.find((rule) => rule.id === 'generic-assignment')?.severity, 'critical');
  assert.equal(resolved.find((rule) => rule.id === 'internal')?.severity, 'high');
  assert.equal(resolved.find((rule) => rule.id === 'internal')?.keywords?.length, 0);
});
