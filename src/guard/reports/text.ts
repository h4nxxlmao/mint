import type { GuardReport } from '../types.js';
import { SEVERITIES } from '../types.js';
import {
  colorSeverity,
  countBySeverity,
  findingDetails,
  remediationLines,
  statsLine,
  summarizeCounts,
  type ReportContext,
} from './shared.js';

/** The default, human report. Grouped by severity, secrets redacted. */
export function renderText(report: GuardReport, context: ReportContext): string {
  const { palette } = context;
  const lines: string[] = [];
  const counts = countBySeverity(report.findings);

  lines.push(`${palette.bold('mint guard')} ${palette.dim(`· ${report.mode} scan · ${report.root}`)}`);
  lines.push('');
  lines.push(
    report.findings.length === 0
      ? `${palette.green('✓')} ${summarizeCounts(report)} - nothing leaked`
      : `${palette.red('!')} ${summarizeCounts(report)}`,
  );
  lines.push(`  ${palette.dim(statsLine(report))}`);
  for (const note of report.notes ?? []) lines.push(`  ${palette.dim(note)}`);
  if (report.baselined > 0) {
    lines.push(`  ${palette.dim(`${String(report.baselined)} known finding(s) ignored via ${report.stats.mode === 'history' ? 'the baseline' : 'the baseline file'}`)}`);
  }
  if (report.stats.truncated) {
    lines.push(`  ${palette.yellow('output truncated:')} ${palette.dim('raise --fail-on scope or work through findings in batches')}`);
  }
  lines.push('');

  for (const severity of SEVERITIES) {
    if (counts[severity] === 0) continue;
    lines.push(colorSeverity(palette, severity, palette.bold(`${severity.toUpperCase()} (${String(counts[severity])})`)));
    for (const finding of report.findings.filter((item) => item.severity === severity)) {
      lines.push(...findingDetails(context, finding));
      lines.push('');
    }
  }

  if (report.findings.length > 0) {
    lines.push(...remediationLines(context));
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
