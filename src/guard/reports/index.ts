import { UsageError } from '../../errors.js';
import type { Flags } from '../../flags.js';
import type { GuardReport, Rule } from '../types.js';
import { renderJson } from './json.js';
import { renderMarkdown } from './markdown.js';
import { renderSarif } from './sarif.js';
import { renderText } from './text.js';
import type { ReportContext } from './shared.js';
import { REPO_URL, VERSION } from '../../version.js';

export type ReportFormat = 'text' | 'json' | 'sarif' | 'markdown';

const FORMATS: readonly ReportFormat[] = ['text', 'json', 'sarif', 'markdown'];

export interface ToolInfo {
  name: string;
  version: string;
  url: string;
}

export const TOOL: ToolInfo = { name: 'mint guard', version: VERSION, url: REPO_URL };

/** `--format text|json|sarif|markdown`, with `--json` as a shorthand. */
export function resolveFormat(flags: Flags, fallback: ReportFormat = 'text'): ReportFormat {
  const raw = flags.getString('format');
  if (raw !== undefined && raw !== '') {
    const normalized = raw.toLowerCase();
    if (normalized === 'md') return 'markdown';
    if (normalized === 'plain') return 'text';
    if (!(FORMATS as readonly string[]).includes(normalized)) {
      throw new UsageError(
        `--format must be one of: ${FORMATS.join(', ')} (got "${raw}")`,
        'example: mint guard scan --format sarif',
      );
    }
    return normalized as ReportFormat;
  }
  return flags.getBool('json') ? 'json' : fallback;
}

export function renderReport(
  report: GuardReport,
  format: ReportFormat,
  context: ReportContext,
  rules: readonly Rule[],
): string {
  switch (format) {
    case 'json':
      return renderJson(report, TOOL);
    case 'sarif':
      return renderSarif(report, TOOL, rules);
    case 'markdown':
      return renderMarkdown(report, TOOL);
    default:
      return renderText(report, context);
  }
}

export type { ReportContext } from './shared.js';
