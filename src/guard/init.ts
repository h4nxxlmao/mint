import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_FILENAME, IGNORE_FILENAME, defaultConfig } from './config.js';

/** `mint guard init`: a config and an ignore file, never an overwrite without --force. */

export type InitOutcome = 'created' | 'exists' | 'overwritten';

export interface InitResult {
  configPath: string;
  ignorePath: string;
  config: InitOutcome;
  ignore: InitOutcome;
}

export function configTemplate(): string {
  const config = defaultConfig();
  const {
    version,
    failOn,
    entropyThreshold,
    entropyMinLength,
    entropyMaxLength,
    entropySeverity,
    maxFileSize,
    includeLockfiles,
    disabledRules,
    rules,
    customRules,
    exclude,
    baselineFile,
    ignoreFiles,
    inlineComments,
  } = config;
  const payload: Record<string, unknown> = {
    version,
    failOn,
    entropyThreshold,
    entropyMinLength,
    entropyMaxLength,
    entropySeverity,
    maxFileSize,
    includeLockfiles,
    disabledRules,
    rules,
    customRules,
    exclude,
    baselineFile,
    ignoreFiles,
    inlineComments,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function ignoreTemplate(): string {
  return [
    '# Paths mint guard should never scan (gitignore syntax).',
    '# Commit this file so the whole team shares the exclusions.',
    '',
    '# test fixtures that intentionally contain fake credentials',
    '# test/fixtures/',
    '',
    '# generated docs and vendored bundles',
    '# dist/',
    '# vendor/',
    '',
  ].join('\n');
}

export function initGuard(root: string, force: boolean): InitResult {
  const configPath = join(root, CONFIG_FILENAME);
  const ignorePath = join(root, IGNORE_FILENAME);

  const write = (path: string, content: string): InitOutcome => {
    if (!existsSync(path)) {
      writeFileSync(path, content, 'utf8');
      return 'created';
    }
    if (!force) return 'exists';
    writeFileSync(path, content, 'utf8');
    return 'overwritten';
  };

  return {
    configPath,
    ignorePath,
    config: write(configPath, configTemplate()),
    ignore: write(ignorePath, ignoreTemplate()),
  };
}
