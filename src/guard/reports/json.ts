import type { GuardReport } from '../types.js';
import { countBySeverity, statsLine } from './shared.js';

/** Machine readable report. Contains previews and hashes, never a secret. */
export function renderJson(report: GuardReport, tool: { name: string; version: string }): string {
  const payload = {
    tool: tool.name,
    version: tool.version,
    mode: report.mode,
    root: report.root,
    failOn: report.failOn,
    summary: {
      ...countBySeverity(report.findings),
      total: report.findings.length,
      baselined: report.baselined,
      truncated: report.stats.truncated,
    },
    stats: {
      filesScanned: report.stats.filesScanned,
      filesSkipped: report.stats.filesSkipped,
      bytesScanned: report.stats.bytesScanned,
      binaries: report.stats.binaries,
      oversized: report.stats.oversized,
      longLinesSkipped: report.stats.longLinesSkipped,
      durationMs: report.stats.durationMs,
      summaryLine: statsLine(report),
    },
    notes: report.notes ?? [],
    findings: report.findings.map((finding) => ({
      id: finding.id,
      hash: finding.hash,
      rule: finding.ruleId,
      ruleName: finding.ruleName,
      severity: finding.severity,
      file: finding.file,
      line: finding.line,
      preview: finding.preview,
      why: finding.why,
      mintCommand: finding.mintCommand,
      rotation: finding.rotation,
      source: finding.source,
      ...(finding.commit ? { commit: finding.commit } : {}),
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}
