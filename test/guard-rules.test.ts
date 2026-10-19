import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { ENTROPY_RULE, PROVIDERS, RULES } from '../src/guard/rules.js';
import { Scanner, fileMarkers } from '../src/guard/scan.js';
import type { Finding, Rule } from '../src/guard/types.js';
import { PLACEHOLDERS, RULE_SAMPLES, cliPath } from './guard-fixtures.js';

const ENTROPY = { threshold: 4.5, minLength: 20, maxLength: 200 };

function scanWith(rule: Rule, content: string): Finding[] {
  const scanner = new Scanner({
    rules: [rule],
    entropyRule: undefined,
    entropy: ENTROPY,
    salt: 'test-salt',
    baselineIds: new Set(),
    inlineComments: true,
    maxFindings: 100,
  });
  scanner.scanContent(content, { file: 'sample.txt', source: 'worktree' }, fileMarkers(content, [rule]));
  return scanner.outcome().findings;
}

test('every built-in rule carries the metadata reports and rotate-help need', () => {
  assert.ok(RULES.length >= 25, `expected at least 25 rules, got ${String(RULES.length)}`);
  for (const rule of RULES) {
    assert.match(rule.id, /^[a-z0-9-]+$/u);
    assert.ok(rule.name.length > 0, `${rule.id} has no name`);
    assert.ok(['low', 'medium', 'high', 'critical'].includes(rule.severity), `${rule.id} has a bad severity`);
    assert.ok(rule.why.length > 20, `${rule.id} needs a why line`);
    assert.ok(rule.mintCommand.startsWith('mint '), `${rule.id} has a bad mint command`);
    assert.ok(rule.rotation in PROVIDERS, `${rule.id} references unknown rotation playbook "${rule.rotation}"`);
    assert.ok(rule.regex.length > 0, `${rule.id} has no regex`);
  }
});

test('rule ids are unique', () => {
  const ids = RULES.map((rule) => rule.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every rule matches its fake sample', () => {
  for (const rule of RULES) {
    const sample = RULE_SAMPLES[rule.id];
    assert.ok(sample !== undefined, `no sample for ${rule.id}`);
    assert.ok(sample.length > 0, `empty sample for ${rule.id}`);
    const findings = scanWith(rule, sample);
    assert.ok(findings.length > 0, `${rule.id} did not match its sample: ${JSON.stringify(sample.slice(0, 80))}`);
  }
});

test('context rules capture the value, not the key name', () => {
  const cases = ['aws-secret-access-key', 'database-url-password', 'generic-assignment', 'twilio-auth-token'];
  for (const id of cases) {
    const rule = RULES.find((item) => item.id === id)!;
    const findings = scanWith(rule, RULE_SAMPLES[id]);
    assert.equal(findings.length, 1, `${id} should produce exactly one finding`);
    const preview = findings[0].preview;
    assert.doesNotMatch(preview, /^(aws_|postgres|twilio|DB_PASS|password)/iu, `${id} captured the key name: ${preview}`);
  }
});

test('placeholders never trigger any rule', () => {
  for (const rule of RULES) {
    for (const placeholder of PLACEHOLDERS) {
      const content = [
        `password = '${placeholder}'`,
        `token: "${placeholder}"`,
        `const api_key = "${placeholder}";`,
        `secret_password = ${placeholder}`,
        placeholder,
      ].join('\n');
      const findings = scanWith(rule, content);
      assert.equal(
        findings.length,
        0,
        `${rule.id} fired on placeholder "${placeholder}": ${findings.map((item) => item.preview).join(', ')}`,
      );
    }
  }
});

test('the synthetic entropy rule has its own metadata', () => {
  assert.equal(ENTROPY_RULE.id, 'entropy-string');
  assert.ok(ENTROPY_RULE.entropy === true);
  assert.ok(ENTROPY_RULE.why.length > 20);
  assert.ok(ENTROPY_RULE.mintCommand.startsWith('mint '));
});

test('every rotation playbook is usable', () => {
  for (const [key, advice] of Object.entries(PROVIDERS)) {
    assert.ok(advice.provider.length > 0, `${key} has no provider name`);
    assert.ok(advice.steps.length >= 2, `${key} needs at least two rotation steps`);
    for (const step of advice.steps) assert.ok(step.length > 10, `${key} has a stub step: ${step}`);
  }
});

test('every replacement command is a valid mint invocation', () => {
  const commands = new Set<string>([...RULES.map((rule) => rule.mintCommand), ENTROPY_RULE.mintCommand]);
  for (const command of commands) {
    const args = command.split(/\s+/u).slice(1);
    const result = spawnSync(process.execPath, [cliPath(), ...args], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, `"${command}" failed: ${result.stderr}`);
    assert.ok((result.stdout ?? '').trim().length > 0, `"${command}" produced no output`);
  }
});

test('severity assignment is sane', () => {
  const severityOf = (id: string): string => RULES.find((rule) => rule.id === id)!.severity;
  assert.equal(severityOf('private-key-block'), 'critical');
  assert.equal(severityOf('aws-secret-access-key'), 'critical');
  assert.equal(severityOf('github-token'), 'critical');
  assert.equal(severityOf('stripe-secret-key'), 'critical');
  assert.equal(severityOf('database-url-password'), 'critical');
  assert.equal(severityOf('aws-access-key-id'), 'high');
  assert.equal(severityOf('generic-assignment'), 'medium');
});
