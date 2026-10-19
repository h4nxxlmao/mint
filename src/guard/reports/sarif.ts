import type { Finding, GuardReport, Rule, Severity } from '../types.js';

/**
 * SARIF 2.1.0 output, valid for GitHub code scanning (`upload-sarif`).
 * Findings carry redacted previews only, so uploading results never publishes a secret.
 */

const SARIF_VERSION = '2.1.0';
const SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json';

function sarifLevel(severity: Severity): 'error' | 'warning' | 'note' {
  if (severity === 'critical' || severity === 'high') return 'error';
  if (severity === 'medium') return 'warning';
  return 'note';
}

function ruleName(id: string): string {
  return id
    .split(/[^A-Za-z0-9]+/u)
    .filter((part) => part !== '')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

function encodeUri(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function renderSarif(
  report: GuardReport,
  tool: { name: string; version: string; url: string },
  rules: readonly Rule[],
): string {
  const usedRules = new Map<string, Rule>();
  for (const rule of rules) usedRules.set(rule.id, rule);
  for (const finding of report.findings) {
    if (!usedRules.has(finding.ruleId)) {
      usedRules.set(finding.ruleId, {
        id: finding.ruleId,
        name: finding.ruleName,
        regex: '',
        severity: finding.severity,
        why: finding.why,
        mintCommand: finding.mintCommand,
        rotation: finding.rotation,
      });
    }
  }

  const ruleList = [...usedRules.values()];
  const ruleIndex = new Map(ruleList.map((rule, index) => [rule.id, index]));

  const payload = {
    $schema: SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: tool.name,
            version: tool.version,
            informationUri: tool.url,
            rules: ruleList.map((rule) => ({
              id: rule.id,
              name: ruleName(rule.id),
              shortDescription: { text: rule.name },
              fullDescription: { text: rule.why },
              help: {
                text: `${rule.why}\n\nRotate it, then generate a replacement: ${rule.mintCommand}`,
                markdown: `${rule.why}\n\n**Rotate it first**, then generate a replacement with \`${rule.mintCommand}\`.`,
              },
              defaultConfiguration: { level: sarifLevel(rule.severity) },
              properties: {
                severity: rule.severity,
                mintCommand: rule.mintCommand,
                rotation: rule.rotation,
                ...(rule.entropy ? { entropy: true } : {}),
              },
            })),
          },
        },
        invocations: [{ executionSuccessful: true }],
        results: report.findings.map((finding) => result(finding, ruleIndex)),
        properties: {
          mode: report.mode,
          root: report.root,
          failOn: report.failOn,
          baselined: report.baselined,
          filesScanned: report.stats.filesScanned,
        },
      },
    ],
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}

function result(finding: Finding, ruleIndex: Map<string, number>): unknown {
  const index = ruleIndex.get(finding.ruleId);
  const message = [
    `${finding.ruleName} found in ${finding.file}:${String(finding.line)} (preview ${finding.preview}).`,
    finding.why,
    `Rotate it first, then replace it with: ${finding.mintCommand}`,
    finding.commit
      ? `Introduced in ${finding.commit.hash.slice(0, 8)} by ${finding.commit.author} on ${finding.commit.date}.`
      : '',
  ]
    .filter((part) => part !== '')
    .join(' ');

  return {
    ruleId: finding.ruleId,
    ...(index === undefined ? {} : { ruleIndex: index }),
    level: sarifLevel(finding.severity),
    message: { text: message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: encodeUri(finding.file) },
          region: { startLine: Math.max(1, finding.line) },
        },
      },
    ],
    partialFingerprints: { mintGuardHash: finding.hash },
    properties: {
      severity: finding.severity,
      preview: finding.preview,
      mintCommand: finding.mintCommand,
      rotation: finding.rotation,
      ...(finding.commit
        ? { commit: finding.commit.hash, author: finding.commit.author, date: finding.commit.date }
        : {}),
    },
  };
}
