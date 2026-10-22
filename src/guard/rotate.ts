import { UsageError } from '../errors.js';
import { defaultRotation, findRule } from './rules.js';
import type { GuardContext, GuardResult, Rule } from './types.js';

/** Env-only rules live here so rotate-help covers them too. */
export const ENV_RULES: readonly Rule[] = [
  {
    id: 'env-file-tracked',
    name: '.env tracked by git',
    regex: '',
    severity: 'critical',
    why: 'A committed .env file is part of the repository history: everyone with access can read every value in it.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'generic',
  },
  {
    id: 'env-file-not-ignored',
    name: '.env not gitignored',
    regex: '',
    severity: 'high',
    why: 'An untracked .env that is not gitignored is one careless "git add ." away from being published.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'generic',
  },
  {
    id: 'env-no-example',
    name: 'No .env.example',
    regex: '',
    severity: 'low',
    why: 'Without an .env.example, contributors copy real values around and secrets end up committed.',
    mintCommand: 'mint password --length 32 --no-ambiguous',
    rotation: 'generic',
  },
];

export function allRulesWithEnv(rules: readonly Rule[]): Rule[] {
  return [...rules, ...ENV_RULES];
}

/** Resolve `rule-id` or `finding-id` (`rule-id-1a2b3c4d`) to a rule. */
export function resolveRuleFromQuery(query: string, rules: readonly Rule[]): Rule | undefined {
  const candidates = allRulesWithEnv(rules);
  const exact = candidates.find((rule) => rule.id === query);
  if (exact) return exact;

  const withoutId = query.replace(/-[0-9a-f]{8}$/u, '');
  const stripped = candidates.find((rule) => rule.id === withoutId);
  if (stripped) return stripped;

  const prefixed = candidates
    .filter((rule) => query.startsWith(`${rule.id}-`) || rule.id.startsWith(withoutId))
    .sort((left, right) => right.id.length - left.id.length)[0];
  if (prefixed) return prefixed;

  return findRule(query, candidates);
}

export function renderRotateHelp(query: string, rules: readonly Rule[], context: GuardContext): GuardResult {
  const rule = resolveRuleFromQuery(query, rules) ?? findRule(query, allRulesWithEnv(rules));
  if (!rule) {
    const known = allRulesWithEnv(rules).map((item) => item.id);
    throw new UsageError(
      `unknown finding or rule "${query}"`,
      `known rules: ${known.slice(0, 6).join(', ')}, ... (run "mint guard rules" for the full list)`,
    );
  }

  const { palette } = context;
  const advice = defaultRotation(rule.rotation);
  const lines: string[] = [];

  lines.push(`${palette.bold(`${advice.provider} - ${rule.name}`)}`);
  lines.push(`  ${palette.dim(`rule: ${rule.id}  severity: ${rule.severity}`)}`);
  lines.push('');
  lines.push(palette.bold('why it matters'));
  lines.push(`  ${rule.why}`);
  lines.push('');
  lines.push(palette.bold('rotate it'));
  advice.steps.forEach((step, index) => {
    lines.push(`  ${String(index + 1)}. ${step}`);
  });
  if (advice.links && advice.links.length > 0) {
    lines.push('');
    lines.push(palette.bold('documentation'));
    for (const link of advice.links) lines.push(`  ${palette.dim(link)}`);
  }
  lines.push('');
  lines.push(palette.bold('generate the replacement with mint'));
  lines.push(`  ${palette.green(rule.mintCommand)}`);
  lines.push('');
  lines.push(palette.bold('then'));
  lines.push('  - revoke or deactivate the leaked value at the provider');
  lines.push('  - review provider logs for use of the leaked credential (assume it was already scraped)');
  lines.push('  - keep the new value in a secret manager or a gitignored .env, never in the repo');
  lines.push(`  - history cleanup is optional and rewrites hashes: ${palette.dim('git filter-repo --path <file> --invert-paths')}`);
  lines.push('');
  lines.push(`${palette.dim('rotation matters more than deletion: deleting the line does not undo the exposure.')}`);

  return { code: 0, stdout: `${lines.join('\n')}\n`, stderr: '' };
}

export function renderRuleTable(
  rules: readonly Rule[],
  context: GuardContext,
  asJson: boolean,
  severities?: readonly string[],
): GuardResult {
  const all = allRulesWithEnv(rules).filter(
    (rule) => severities === undefined || severities.length === 0 || severities.includes(rule.severity),
  );
  if (asJson) {
    const payload = all.map((rule) => ({
      id: rule.id,
      name: rule.name,
      severity: rule.severity,
      keywords: rule.keywords ?? [],
      why: rule.why,
      mintCommand: rule.mintCommand,
      rotation: rule.rotation,
      builtIn: !ENV_RULES.includes(rule),
    }));
    return { code: 0, stdout: `${JSON.stringify({ rules: payload }, null, 2)}\n`, stderr: '' };
  }

  const { palette } = context;
  const width = Math.max(...all.map((rule) => rule.id.length));
  const lines: string[] = [];
  lines.push(`${palette.bold('mint guard rules')} ${palette.dim(`(${String(all.length)})`)}`);
  lines.push('');
  for (const rule of all) {
    lines.push(`  ${palette.cyan(rule.id.padEnd(width))}  ${rule.severity.padEnd(8)} ${rule.name}`);
    lines.push(`  ${' '.repeat(width)}  ${palette.dim(`fix: ${rule.mintCommand}`)}`);
  }
  lines.push('');
  lines.push(`${palette.dim('add your own in .mintguard.json (customRules) or disable one with disabledRules.')}`);
  return { code: 0, stdout: `${lines.join('\n')}\n`, stderr: '' };
}
