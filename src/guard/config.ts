import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { UsageError } from '../errors.js';
import { ENTROPY_RULE, ENTROPY_RULE_ID, RULES } from './rules.js';
import { isSeverity, type CustomRuleInput, type GuardConfig, type GuardContext, type Rule, type Severity } from './types.js';
import type { EntropyOptions } from './entropy.js';

export const CONFIG_FILENAME = '.mintguard.json';
export const IGNORE_FILENAME = '.mintguardignore';
export const BASELINE_FILENAME = '.mintguard-baseline.json';
export const CONFIG_VERSION = 1;

export function defaultConfig(): GuardConfig {
  return {
    version: CONFIG_VERSION,
    failOn: 'medium',
    entropyThreshold: 4.5,
    entropyMinLength: 20,
    entropyMaxLength: 200,
    entropySeverity: 'high',
    maxFileSize: 1024 * 1024,
    includeLockfiles: false,
    disabledRules: [],
    rules: {},
    customRules: [],
    exclude: [],
    baselineFile: BASELINE_FILENAME,
    ignoreFiles: [IGNORE_FILENAME],
    inlineComments: true,
  };
}

function asStringArray(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new UsageError(`${CONFIG_FILENAME}: "${field}" must be an array of strings`);
  }
  return value as string[];
}

function asNumber(value: unknown, field: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new UsageError(`${CONFIG_FILENAME}: "${field}" must be a number`);
  }
  return value;
}

function asBoolean(value: unknown, field: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new UsageError(`${CONFIG_FILENAME}: "${field}" must be a boolean`);
  return value;
}

function asSeverity(value: unknown, field: string, fallback: Severity): Severity {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !isSeverity(value)) {
    throw new UsageError(`${CONFIG_FILENAME}: "${field}" must be one of critical, high, medium, low`);
  }
  return value;
}

function parseCustomRules(value: unknown): CustomRuleInput[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new UsageError(`${CONFIG_FILENAME}: "customRules" must be an array`);
  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new UsageError(`${CONFIG_FILENAME}: customRules[${index}] must be an object`);
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== 'string' || record.id.trim() === '') {
      throw new UsageError(`${CONFIG_FILENAME}: customRules[${index}].id is required`);
    }
    if (typeof record.regex !== 'string' || record.regex.trim() === '') {
      throw new UsageError(`${CONFIG_FILENAME}: customRules[${index}].regex is required`);
    }
    const rule: CustomRuleInput = { id: record.id, regex: record.regex };
    if (typeof record.name === 'string') rule.name = record.name;
    if (typeof record.why === 'string') rule.why = record.why;
    if (typeof record.mintCommand === 'string') rule.mintCommand = record.mintCommand;
    if (typeof record.rotation === 'string') rule.rotation = record.rotation;
    if (record.severity !== undefined) rule.severity = asSeverity(record.severity, `customRules[${index}].severity`, 'medium');
    if (record.keywords !== undefined) rule.keywords = asStringArray(record.keywords, `customRules[${index}].keywords`);
    return rule;
  });
}

function parseRuleOverrides(value: unknown): Record<string, { severity?: Severity; disabled?: boolean }> {
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null) {
    throw new UsageError(`${CONFIG_FILENAME}: "rules" must be an object keyed by rule id`);
  }
  const overrides: Record<string, { severity?: Severity; disabled?: boolean }> = {};
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null) {
      throw new UsageError(`${CONFIG_FILENAME}: rules.${id} must be an object`);
    }
    const record = entry as Record<string, unknown>;
    const override: { severity?: Severity; disabled?: boolean } = {};
    if (record.severity !== undefined) override.severity = asSeverity(record.severity, `rules.${id}.severity`, 'medium');
    if (record.disabled !== undefined) override.disabled = asBoolean(record.disabled, `rules.${id}.disabled`, false);
    overrides[id] = override;
  }
  return overrides;
}

/** Load `.mintguard.json` (or an explicit path). Missing file means defaults. */
export function loadConfig(root: string, explicitPath?: string): GuardConfig {
  const config = defaultConfig();
  const path = explicitPath === undefined
    ? join(root, CONFIG_FILENAME)
    : (isAbsolute(explicitPath) ? explicitPath : join(root, explicitPath));

  if (!existsSync(path)) {
    if (explicitPath !== undefined) throw new UsageError(`config file not found: ${explicitPath}`);
    return config;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new UsageError(`${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new UsageError(`${path} must contain a JSON object`);
  }
  const record = parsed as Record<string, unknown>;

  config.failOn = asSeverity(record.failOn, 'failOn', config.failOn);
  config.entropyThreshold = asNumber(record.entropyThreshold, 'entropyThreshold', config.entropyThreshold);
  config.entropyMinLength = asNumber(record.entropyMinLength, 'entropyMinLength', config.entropyMinLength);
  config.entropyMaxLength = asNumber(record.entropyMaxLength, 'entropyMaxLength', config.entropyMaxLength);
  config.entropySeverity = asSeverity(record.entropySeverity, 'entropySeverity', config.entropySeverity);
  config.maxFileSize = asNumber(record.maxFileSize, 'maxFileSize', config.maxFileSize);
  config.includeLockfiles = asBoolean(record.includeLockfiles, 'includeLockfiles', config.includeLockfiles);
  config.disabledRules = asStringArray(record.disabledRules, 'disabledRules');
  config.rules = parseRuleOverrides(record.rules);
  config.customRules = parseCustomRules(record.customRules);
  config.exclude = asStringArray(record.exclude, 'exclude');
  config.baselineFile = typeof record.baselineFile === 'string' ? record.baselineFile : config.baselineFile;
  config.ignoreFiles = record.ignoreFiles === undefined ? config.ignoreFiles : asStringArray(record.ignoreFiles, 'ignoreFiles');
  config.inlineComments = asBoolean(record.inlineComments, 'inlineComments', config.inlineComments);
  config.path = path;

  for (const rule of config.customRules) {
    try {
      new RegExp(rule.regex, 'u');
    } catch (error) {
      throw new UsageError(`custom rule "${rule.id}" has an invalid regex: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return config;
}

export function customRuleToRule(input: CustomRuleInput): Rule {
  return {
    id: input.id,
    name: input.name ?? input.id,
    regex: input.regex,
    severity: input.severity ?? 'medium',
    keywords: input.keywords ?? [],
    why: input.why ?? 'This pattern was configured as sensitive in .mintguard.json.',
    mintCommand: input.mintCommand ?? 'mint token --bytes 32',
    rotation: input.rotation ?? 'generic',
  };
}

/** Apply disables, severity overrides and custom rules. */
export function resolveRules(config: GuardConfig): Rule[] {
  const disabled = new Set(config.disabledRules);
  const resolved: Rule[] = [];
  for (const rule of RULES) {
    const override = config.rules[rule.id];
    if (disabled.has(rule.id) || override?.disabled === true) continue;
    resolved.push(override?.severity ? { ...rule, severity: override.severity } : rule);
  }
  for (const custom of config.customRules) {
    const override = config.rules[custom.id];
    if (disabled.has(custom.id) || override?.disabled === true) continue;
    const rule = customRuleToRule(custom);
    resolved.push(override?.severity ? { ...rule, severity: override.severity } : rule);
  }
  return resolved;
}

export function entropyRule(config: GuardConfig): Rule {
  const override = config.rules[ENTROPY_RULE_ID];
  const severity = override?.severity ?? config.entropySeverity;
  return { ...ENTROPY_RULE, severity };
}

export interface ResolvedOptions {
  config: GuardConfig;
  rules: Rule[];
  entropyRule: Rule | undefined;
  entropy: EntropyOptions;
  failOn: Severity;
  maxFileSize: number;
  includeLockfiles: boolean;
  useGitignore: boolean;
  baselineFile: string;
  salt: string;
  baselineIds: Set<string>;
  baselineLoaded: boolean;
  ruleFilter: string[] | undefined;
}

/** Config + command line flags, in one place. `loadBaseline` is injected to avoid a cycle. */
export function resolveOptions(
  context: GuardContext,
  root: string,
  loadBaseline: (path: string) => { salt: string; ids: Set<string> } | undefined,
): ResolvedOptions {
  const config = loadConfig(root, context.flags.getString('config'));
  const flags = context.flags;

  const failOnFlag = flags.getString('fail-on');
  if (failOnFlag !== undefined) {
    if (!isSeverity(failOnFlag)) {
      throw new UsageError(`--fail-on must be one of critical, high, medium, low (got "${failOnFlag}")`);
    }
    config.failOn = failOnFlag;
  }

  const threshold = flags.getString('entropy-threshold');
  if (threshold !== undefined) {
    const value = Number(threshold);
    if (!Number.isFinite(value) || value <= 0 || value > 8) {
      throw new UsageError(`--entropy-threshold must be a number between 0 and 8 (got "${threshold}")`);
    }
    config.entropyThreshold = value;
  }

  const maxFileSize = flags.getSize('max-file-size');
  if (maxFileSize !== undefined) config.maxFileSize = maxFileSize;
  if (flags.has('include-lockfiles')) config.includeLockfiles = flags.getBool('include-lockfiles');
  if (flags.has('inline-comments')) config.inlineComments = flags.getBool('inline-comments');

  const ruleFilter = flags.getString('rules')
    ?.split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const baselineFileFlag = flags.getString('baseline-file') ?? config.baselineFile;
  const baselineFile = isAbsolute(baselineFileFlag) ? baselineFileFlag : join(root, baselineFileFlag);

  let salt = '';
  let baselineIds = new Set<string>();
  let baselineLoaded = false;
  if (flags.getBool('baseline', true)) {
    const baseline = loadBaseline(baselineFile);
    if (baseline) {
      salt = baseline.salt;
      baselineIds = baseline.ids;
      baselineLoaded = true;
    }
  }

  const allRules = resolveRules(config);
  const entropy = {
    threshold: config.entropyThreshold,
    minLength: config.entropyMinLength,
    maxLength: config.entropyMaxLength,
  };

  let rules = allRules;
  let entropyEnabled = true;
  let entropyRuleValue: Rule | undefined = entropyRule(config);
  if (ruleFilter && ruleFilter.length > 0) {
    const known = new Set([...allRules.map((rule) => rule.id), ENTROPY_RULE_ID]);
    const unknown = ruleFilter.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new UsageError(`unknown rule id: ${unknown.join(', ')}`, 'run "mint guard rules" to list every rule');
    }
    rules = allRules.filter((rule) => ruleFilter.includes(rule.id));
    entropyEnabled = ruleFilter.includes(ENTROPY_RULE_ID);
    entropyRuleValue = entropyEnabled ? entropyRuleValue : undefined;
  }
  if (config.rules[ENTROPY_RULE_ID]?.disabled === true || config.disabledRules.includes(ENTROPY_RULE_ID)) {
    entropyEnabled = false;
    entropyRuleValue = undefined;
  }

  return {
    config,
    rules,
    entropyRule: entropyRuleValue,
    entropy,
    failOn: config.failOn,
    maxFileSize: config.maxFileSize,
    includeLockfiles: config.includeLockfiles,
    useGitignore: flags.getBool('gitignore', true),
    baselineFile,
    salt,
    baselineIds,
    baselineLoaded,
    ruleFilter,
  };
}
