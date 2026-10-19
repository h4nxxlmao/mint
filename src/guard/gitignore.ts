/**
 * Gitignore-style pattern matching, implemented by hand (no dependencies).
 *
 * Supports comments, blank lines, trailing-space stripping, `!` negation, trailing
 * `/` for directories, leading/middle/trailing `**`, `*`, `?` and `[...]` classes,
 * and the anchoring rule (a slash anywhere but the end anchors the pattern to the
 * directory of the file it came from). Later patterns win, matching git.
 */

export interface IgnoreRule {
  negated: boolean;
  dirOnly: boolean;
  regex: RegExp;
  source: string;
}

function escapeRegex(char: string): string {
  return /[.*+?^${}()|[\]\\]/u.test(char) ? `\\${char}` : char;
}

function classEnd(pattern: string, start: number): number {
  for (let index = start + 1; index < pattern.length; index++) {
    if (pattern[index] === ']' && index > start + 1) return index;
  }
  return start;
}

/** Translate one gitignore pattern body into a regex source (no anchors). */
export function globToRegexSource(pattern: string): string {
  let out = '';
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index];
    if (char === '*') {
      const doubled = pattern[index + 1] === '*';
      const atSegmentStart = index === 0 || pattern[index - 1] === '/';
      if (doubled && atSegmentStart) {
        const after = pattern[index + 2];
        if (after === '/') {
          out += '(?:.*/)?';
          index += 2;
          continue;
        }
        if (after === undefined) {
          out += '.*';
          index += 1;
          continue;
        }
      }
      if (doubled) {
        out += '.*';
        index += 1;
        continue;
      }
      out += '[^/]*';
      continue;
    }
    if (char === '?') {
      out += '[^/]';
      continue;
    }
    if (char === '[') {
      const end = classEnd(pattern, index);
      out += pattern.slice(index, end + 1);
      index = end;
      continue;
    }
    out += escapeRegex(char);
  }
  return out;
}

/** Compile a single non-comment pattern line. Returns undefined for comments/blank lines. */
export function compileIgnoreRule(line: string): IgnoreRule | undefined {
  let text = line.replace(/(?<!\\)\s+$/u, '');
  if (text.trim() === '' || text.startsWith('#')) return undefined;
  if (text.startsWith('\\#') || text.startsWith('\\!')) text = text.slice(1);

  let negated = false;
  if (text.startsWith('!')) {
    negated = true;
    text = text.slice(1);
  }
  if (text === '') return undefined;

  let dirOnly = false;
  if (text.endsWith('/')) {
    dirOnly = true;
    text = text.slice(0, -1);
  }

  // A leading slash anchors the pattern to the ignore file's directory; the slash
  // itself is not part of the path.
  const anchored = text.includes('/');
  if (text.startsWith('/')) text = text.slice(1);
  if (text === '') return undefined;

  const source = globToRegexSource(text);
  const body = anchored ? `^${source}$` : `(?:^|/)${source}$`;
  return { negated, dirOnly, regex: new RegExp(body, 'u'), source: line };
}

interface RuleGroup {
  baseDir: string;
  rules: IgnoreRule[];
}

export class IgnoreSet {
  private readonly groups: RuleGroup[] = [];
  private readonly patterns: IgnoreRule[] = [];

  /** Add the contents of an ignore file that lives in `baseDir` (relative to the scan root). */
  addIgnoreFile(baseDir: string, lines: readonly string[]): void {
    const rules: IgnoreRule[] = [];
    for (const line of lines) {
      const rule = compileIgnoreRule(line);
      if (rule) rules.push(rule);
    }
    if (rules.length > 0) this.groups.push({ baseDir, rules });
  }

  /** Add path patterns that are not tied to a directory (config `exclude`, etc.). */
  addPatterns(patterns: readonly string[]): void {
    for (const pattern of patterns) {
      const rule = compileIgnoreRule(pattern);
      if (rule) this.patterns.push(rule);
    }
  }

  private static match(rule: IgnoreRule, candidate: string): boolean {
    rule.regex.lastIndex = 0;
    return rule.regex.test(candidate);
  }

  /** True when the path (relative to the scan root, forward slashes) is ignored. */
  ignores(relativePath: string, isDirectory: boolean): boolean {
    let ignored = false;

    for (const rule of this.patterns) {
      if (rule.dirOnly && !isDirectory) continue;
      if (IgnoreSet.match(rule, relativePath)) ignored = !rule.negated;
    }

    for (const group of this.groups) {
      let candidate = relativePath;
      if (group.baseDir !== '') {
        if (relativePath === group.baseDir) continue;
        if (!relativePath.startsWith(`${group.baseDir}/`)) continue;
        candidate = relativePath.slice(group.baseDir.length + 1);
      }
      for (const rule of group.rules) {
        if (rule.dirOnly && !isDirectory) continue;
        if (IgnoreSet.match(rule, candidate)) ignored = !rule.negated;
      }
    }

    return ignored;
  }
}

export function parseIgnoreLines(content: string): string[] {
  return content.split(/\r?\n/u);
}
