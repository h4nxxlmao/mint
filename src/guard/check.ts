import { UsageError } from '../errors.js';
import { readStdinText } from '../stdin.js';
import { VERSION } from '../version.js';
import type { ResolvedOptions } from './config.js';
import { shannonEntropy } from './entropy.js';
import { defaultRotation } from './rules.js';
import { Scanner, fileMarkers } from './scan.js';
import { colorSeverity, severityLabel } from './reports/shared.js';
import type { Finding, GuardContext } from './types.js';

/** `mint guard check`: identify one value without scanning a project. */

export interface CheckInput {
  value: string;
  fromStdin: boolean;
}

export function readCheckInput(context: GuardContext): CheckInput {
  const fromArgs = context.positionals[0];
  if (fromArgs !== undefined) {
    if (fromArgs.trim() === '') throw new UsageError('the value to check is empty');
    return { value: fromArgs, fromStdin: false };
  }
  const piped = readStdinText();
  if (piped === '') {
    throw new UsageError(
      'check needs a value',
      'mint guard check "<value>" or pipe it: pbpaste | mint guard check',
    );
  }
  return { value: piped, fromStdin: true };
}

/** Run the full rule set (plus entropy) over a single input string. */
export function scanValue(value: string, options: ResolvedOptions): Finding[] {
  const scanner = new Scanner({
    rules: options.rules,
    entropyRule: options.entropyRule,
    entropy: options.entropy,
    salt: '',
    baselineIds: new Set(),
    inlineComments: false,
    maxFindings: 50,
  });
  scanner.scanContent(value, { file: '<input>', source: 'check' }, fileMarkers(value, options.rules));
  return scanner.outcome().findings;
}

function findingLines(finding: Finding, palette: GuardContext['palette']): string[] {
  const lines: string[] = [];
  lines.push(
    `  ${colorSeverity(palette, finding.severity, severityLabel(finding.severity).padEnd(8))} ${palette.bold(finding.ruleId)} ${palette.dim(`- ${finding.ruleName}`)}`,
  );
  lines.push(`           ${palette.dim('preview:')} ${finding.preview}`);
  lines.push(`           ${palette.dim('why:')} ${finding.why}`);
  lines.push(`           ${palette.dim('replace:')} ${palette.green(finding.mintCommand)}`);
  lines.push(`           ${palette.dim(`rotation: mint guard rotate-help ${finding.ruleId}`)}`);
  return lines;
}

export function renderCheckJson(input: CheckInput, findings: readonly Finding[]): string {
  const value = input.value.trim();
  const payload = {
    tool: 'mint guard',
    version: VERSION,
    detected: findings.length > 0,
    input: {
      length: value.length,
      entropyPerCharacter: Number(shannonEntropy(value).toFixed(2)),
      fromStdin: input.fromStdin,
    },
    findings: findings.map((finding) => ({
      id: finding.id,
      rule: finding.ruleId,
      ruleName: finding.ruleName,
      severity: finding.severity,
      preview: finding.preview,
      why: finding.why,
      mintCommand: finding.mintCommand,
      rotation: finding.rotation,
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function renderCheckText(
  input: CheckInput,
  findings: readonly Finding[],
  options: ResolvedOptions,
  context: GuardContext,
): string {
  const { palette } = context;
  const value = input.value.trim();
  const lines: string[] = [`${palette.bold('mint guard check')}`, ''];

  if (findings.length === 0) {
    lines.push(`  ${palette.green('✓')} no known secret pattern`);
    lines.push(`  ${palette.dim(`${String(value.length)} characters, ${shannonEntropy(value).toFixed(2)} bits/char`)}`);
  } else {
    const providers = new Set(findings.map((finding) => defaultRotation(finding.rotation).provider));
    lines.push(
      `  ${palette.red('!')} looks like ${findings.length === 1 ? 'a' : String(findings.length) + ' kind(s) of'} secret (${[...providers].join(', ')})`,
    );
    lines.push('');
    for (const finding of findings.slice(0, 5)) {
      lines.push(...findingLines(finding, palette));
      lines.push('');
    }
    lines.push(`  ${palette.bold('rotate it first')} - the value is compromised the moment it was shared.`);
    lines.push(`  ${palette.dim('then generate a replacement with the command above.')}`);
    lines.push(`  ${palette.dim(`fails at or above: ${options.failOn}`)}`);
  }

  if (!input.fromStdin) {
    lines.push('');
    lines.push(`  ${palette.dim('tip: pipe the value on stdin to keep it out of your shell history')}`);
  }
  return `${lines.join('\n')}\n`;
}
