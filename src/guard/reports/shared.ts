import type { Palette } from '../../colors.js';
import type { Finding, GuardReport, ScanStats, Severity } from '../types.js';
import { SEVERITIES } from '../types.js';

export interface ReportContext {
  palette: Palette;
  version: string;
  /** `--fix`: print the remediation steps in full. */
  fix: boolean;
  quiet: boolean;
}

export function countBySeverity(findings: readonly Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) counts[finding.severity]++;
  return counts;
}

export function severityLabel(severity: Severity): string {
  return severity.toUpperCase();
}

export function colorSeverity(palette: Palette, severity: Severity, text: string): string {
  switch (severity) {
    case 'critical':
      return palette.red(text);
    case 'high':
      return palette.magenta(text);
    case 'medium':
      return palette.yellow(text);
    default:
      return palette.dim(text);
  }
}

export function summarizeCounts(report: GuardReport): string {
  const counts = countBySeverity(report.findings);
  if (report.findings.length === 0) return 'no findings';
  const parts = SEVERITIES.filter((severity) => counts[severity] > 0).map(
    (severity) => `${String(counts[severity])} ${severity}`,
  );
  return `${String(report.findings.length)} finding${report.findings.length === 1 ? '' : 's'} (${parts.join(', ')})`;
}

export function statsSummary(stats: ScanStats): string {
  const parts = [
    `${String(stats.filesScanned)} file${stats.filesScanned === 1 ? '' : 's'} scanned`,
    `${formatBytes(stats.bytesScanned)}`,
  ];
  if (stats.filesSkipped > 0) parts.push(`${String(stats.filesSkipped)} skipped`);
  if (stats.binaries > 0) parts.push(`${String(stats.binaries)} binary`);
  if (stats.oversized > 0) parts.push(`${String(stats.oversized)} over size limit`);
  if (stats.longLinesSkipped > 0) parts.push(`${String(stats.longLinesSkipped)} long lines ignored`);
  parts.push(`${(stats.durationMs / 1000).toFixed(2)}s`);
  return parts.join(' · ');
}

export function statsLine(report: GuardReport): string {
  return statsSummary(report.stats);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function remediationLines(context: ReportContext): string[] {
  const lines: string[] = [];
  lines.push(context.palette.bold('next steps'));
  lines.push('  1. rotate the exposed secret first - it is compromised the moment it was committed');
  lines.push('     deleting the line does not undo the exposure; a new value does');
  lines.push('  2. store the replacement in your secret manager or a gitignored .env');
  lines.push('     generate one with: mint password --length 32   (or see the per-finding fix)');
  lines.push('  3. commit an .env.example with placeholders instead, and add the real file to .gitignore');
  lines.push('  4. clean up git history only after rotating (it rewrites every hash):');
  lines.push('       git filter-repo --path <file> --invert-paths');
  lines.push(`     ${context.palette.dim('mint guard never rewrites history for you - it only prints this plan')}`);
  lines.push(`  ${context.palette.dim('provider specific steps: mint guard rotate-help <finding-id>')}`);
  return lines;
}

export function findingDetails(context: ReportContext, finding: Finding): string[] {
  const { palette } = context;
  const lines: string[] = [];
  const place = finding.line > 0 ? `${finding.file}:${String(finding.line)}` : finding.file;
  const location = finding.commit
    ? `${place} ${palette.dim(`(${finding.commit.hash.slice(0, 8)} ${finding.commit.date} by ${finding.commit.author})`)}`
    : place;
  lines.push(
    `  ${colorSeverity(palette, finding.severity, severityLabel(finding.severity).padEnd(8))} ${palette.bold(finding.ruleId.padEnd(24))} ${location}`,
  );
  lines.push(`  ${' '.repeat(8)} ${palette.dim(finding.ruleName)}`);
  lines.push(`  ${' '.repeat(8)} ${palette.dim('preview:')} ${finding.preview}`);
  lines.push(`  ${' '.repeat(8)} ${palette.dim('why:')} ${finding.why}`);
  lines.push(`  ${' '.repeat(8)} ${palette.dim('fix:')} ${palette.green(finding.mintCommand)}`);
  lines.push(`  ${' '.repeat(8)} ${palette.dim(`id: ${finding.id}`)}`);
  return lines;
}
