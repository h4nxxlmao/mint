import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { plainPalette } from '../src/colors.js';
import { RULES } from '../src/guard/rules.js';
import { findingHash, findingId, isRedacted, newSalt, previewSecret } from '../src/guard/redact.js';
import { renderReport } from '../src/guard/reports/index.js';
import { Scanner, fileMarkers } from '../src/guard/scan.js';
import type { Finding, GuardReport, Rule, ScanStats } from '../src/guard/types.js';
import { RULE_SAMPLES } from './guard-fixtures.js';

const ENTROPY = { threshold: 4.5, minLength: 20, maxLength: 200 };

function stats(): ScanStats {
  return {
    mode: 'worktree',
    filesScanned: 1,
    filesSkipped: 0,
    bytesScanned: 100,
    longLinesSkipped: 0,
    truncated: false,
    oversized: 0,
    binaries: 0,
    durationMs: 1,
  };
}

/** The raw value a rule extracts from a sample, using the rule's own capture group. */
function extractValue(rule: Rule, sample: string): string | undefined {
  const flags = rule.flags ?? 'gu';
  const regex = new RegExp(rule.regex, flags.includes('g') ? flags : `${flags}g`);
  for (const line of sample.split(/\r?\n/u)) {
    regex.lastIndex = 0;
    const match = regex.exec(line);
    if (match) return (match[rule.capture ?? 0] ?? '').trim();
  }
  return undefined;
}

function scanSample(rule: Rule, sample: string): Finding[] {
  const scanner = new Scanner({
    rules: [rule],
    entropyRule: undefined,
    entropy: ENTROPY,
    salt: 'report-salt',
    baselineIds: new Set(),
    inlineComments: false,
    maxFindings: 10,
  });
  scanner.scanContent(sample, { file: 'sample.txt', source: 'worktree' }, fileMarkers(sample, [rule]));
  return scanner.outcome().findings;
}

test('previewSecret shows at most the first four and last two characters', () => {
  assert.equal(previewSecret('AKIAIOSFODNN7EXAMPLE'), 'AKIA...LE');
  assert.equal(previewSecret('123456789012'), '1234...12');
  assert.equal(previewSecret('short'), '***');
  assert.equal(previewSecret(''), '***');
  assert.equal(previewSecret('  padded-value-123456  '), 'padd...56');
});

test('previewSecret never contains the secret or its middle', () => {
  for (const value of ['AKIAIOSFODNN7EXAMPLE', 'Qm7Zx2Lp9Rt4Vb8Nc1Md6Kf3Hg5Js0Da', 'abcdefghijklmnop']) {
    const preview = previewSecret(value);
    assert.ok(isRedacted(preview, value), `preview leaked ${value}`);
    assert.ok(!preview.includes(value.slice(4, -2)), 'preview leaked the middle of the value');
  }
});

test('finding ids embed the rule id and are stable', () => {
  const first = findingId('github-token', 'src/a.ts', 4, 'ghp_secret');
  const second = findingId('github-token', 'src/a.ts', 4, 'ghp_secret');
  assert.equal(first, second);
  assert.match(first, /^github-token-[0-9a-f]{8}$/u);
  assert.notEqual(first, findingId('github-token', 'src/b.ts', 4, 'ghp_secret'));
  assert.notEqual(first, findingId('github-token', 'src/a.ts', 5, 'ghp_secret'));
});

test('baseline hashes are salted and deterministic per salt', () => {
  const saltA = newSalt();
  const saltB = newSalt();
  assert.notEqual(saltA, saltB);
  assert.equal(findingHash(saltA, 'jwt', 'a.ts', 'value'), findingHash(saltA, 'jwt', 'a.ts', 'value'));
  assert.notEqual(findingHash(saltA, 'jwt', 'a.ts', 'value'), findingHash(saltB, 'jwt', 'a.ts', 'value'));
  assert.notEqual(findingHash(saltA, 'jwt', 'a.ts', 'value'), findingHash(saltA, 'jwt', 'b.ts', 'value'));
});

test('no report format ever contains a raw secret', () => {
  const findings: Finding[] = [];
  const rawValues: string[] = [];

  for (const rule of RULES) {
    const sample = RULE_SAMPLES[rule.id];
    if (!sample) continue;
    const raw = extractValue(rule, sample);
    if (raw === undefined) continue;
    rawValues.push(raw);
    findings.push(...scanSample(rule, sample));
  }

  assert.ok(findings.length > 20, `expected many findings, got ${String(findings.length)}`);

  const report: GuardReport = {
    mode: 'worktree',
    stats: stats(),
    findings,
    baselined: 0,
    failOn: 'medium',
    root: '.',
    notes: ['note'],
  };

  for (const format of ['text', 'json', 'sarif', 'markdown'] as const) {
    const output = renderReport(report, format, { palette: plainPalette, version: '1.1.0', fix: true, quiet: false }, RULES);
    assert.ok(output.length > 0, `${format} output was empty`);
    for (const raw of rawValues) {
      assert.ok(!output.includes(raw), `${format} output contained a raw secret: ${raw}`);
    }
  }

  const baseline = JSON.stringify(
    findings.map((finding) => ({ id: finding.id, hash: finding.hash, rule: finding.ruleId, file: finding.file, severity: finding.severity })),
  );
  for (const raw of rawValues) {
    assert.ok(!baseline.includes(raw), 'baseline contained a raw secret');
  }
});

test('findings carry a redacted preview, never the value', () => {
  for (const rule of RULES) {
    const sample = RULE_SAMPLES[rule.id];
    if (!sample) continue;
    const raw = extractValue(rule, sample);
    if (raw === undefined) continue;
    for (const finding of scanSample(rule, sample)) {
      assert.ok(isRedacted(finding.preview, raw), `${rule.id} preview leaked the secret`);
      if (raw.length >= 12) assert.match(finding.preview, /^.{4}\.\.\..{2}$/u);
    }
  }
});

test('sarif carries stable partial fingerprints', () => {
  const finding: Finding = {
    id: 'jwt-12345678',
    hash: 'abcdef0123456789',
    ruleId: 'jwt',
    ruleName: 'JSON Web Token',
    severity: 'medium',
    file: 'src/auth.ts',
    line: 7,
    preview: 'eyJh...zz',
    why: 'why',
    mintCommand: 'mint jwt-secret --algo hs512',
    rotation: 'jwt',
    source: 'worktree',
  };
  const report: GuardReport = { mode: 'worktree', stats: stats(), findings: [finding], baselined: 0, failOn: 'medium', root: '.' };
  const output = renderReport(report, 'sarif', { palette: plainPalette, version: '1.1.0', fix: false, quiet: false }, RULES);
  const sarif = JSON.parse(output);
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs[0].results[0].partialFingerprints.mintGuardHash, 'abcdef0123456789');
  assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.region.startLine, 7);
  assert.equal(sarif.runs[0].results[0].level, 'warning');
});
