import type { GuardReport } from '../types.js';
import { SEVERITIES } from '../types.js';
import { countBySeverity, statsLine } from './shared.js';

/** Markdown report, ready to drop into a pull request comment or a job summary. */
export function renderMarkdown(report: GuardReport, tool: { name: string; version: string }): string {
  const lines: string[] = [];
  const counts = countBySeverity(report.findings);

  lines.push(`# ${report.findings.length === 0 ? 'No leaked secrets' : `${String(report.findings.length)} potential leaks`}`);
  lines.push('');
  lines.push(`\`${tool.name}\` ${tool.version} · ${report.mode} scan · \`${report.root}\``);
  lines.push('');
  lines.push(statsLine(report));
  if (report.baselined > 0) lines.push(`· ${String(report.baselined)} known finding(s) ignored via the baseline`);
  lines.push('');

  if (report.findings.length === 0) {
    lines.push('Nothing that looks like a leaked credential was found.');
    return `${lines.join('\n')}\n`;
  }

  const summary = SEVERITIES.filter((severity) => counts[severity] > 0)
    .map((severity) => `${String(counts[severity])} ${severity}`)
    .join(' · ');
  lines.push(`**${summary}**`);
  lines.push('');
  lines.push('| Severity | Rule | Location | Preview | Replacement |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const finding of report.findings) {
    const location = finding.commit
      ? `\`${finding.file}:${String(finding.line)}\` (${finding.commit.hash.slice(0, 8)})`
      : `\`${finding.file}:${String(finding.line)}\``;
    lines.push(
      `| ${finding.severity} | \`${finding.ruleId}\` | ${location} | \`${finding.preview}\` | \`${finding.mintCommand}\` |`,
    );
  }
  lines.push('');
  lines.push('## Next steps');
  lines.push('');
  lines.push('1. **Rotate the exposed secret first** - it is compromised the moment it was committed.');
  lines.push('2. Store the replacement in your secret manager or a gitignored `.env` (`.env.example` keeps placeholders).');
  lines.push('3. Clean history only after rotating, e.g. `git filter-repo --path <file> --invert-paths`.');
  lines.push('4. Provider specific steps: `mint guard rotate-help <finding-id>`.');
  return `${lines.join('\n')}\n`;
}
