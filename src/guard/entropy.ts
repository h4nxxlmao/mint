/**
 * Entropy-based detection: catches secrets whose format we have never seen.
 *
 * Shannon entropy over the characters of a candidate string, plus a pile of filters
 * for the things that look random but are not secrets (UUIDs, digests, placeholders,
 * base64 images, prose).
 */

/** Shannon entropy in bits per character. */
export function shannonEntropy(text: string): number {
  if (text.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const char of text) counts.set(char, (counts.get(char) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / text.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

const PLACEHOLDER_WORDS = [
  'changeme',
  'change_me',
  'change-me',
  'replaceme',
  'replace_me',
  'your_',
  'your-',
  'yourapikey',
  'replace',
  'change',
  'insert',
  'example',
  'sample',
  'placeholder',
  'dummy',
  'fake',
  'redacted',
  'notreal',
  'not_real',
  'todo',
  'fixme',
  'xxxx',
  'yyyy',
  'abcd1234',
  'abc123',
  'foo',
  'bar',
  'baz',
  'test',
  'testing',
  'secret',
  'password',
  'passwd',
  'token',
  'apikey',
  'api_key',
  'somekey',
  'some_key',
  'none',
  'null',
  'undefined',
  'ignore',
  'lorem',
  'ipsum',
];

const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /^<.*>$/,
  /^\$\{.*\}$/,
  /^\{\{.*\}\}$/,
  /^%.*%$/,
  /^\*+$/,
  /^x{4,}$/i,
  /^\.{3,}$/,
  /^[-_=]{4,}$/,
  /^(?:process\.env|os\.environ|env|import\.meta\.env)/,
  /^\{\{\s*\w+\s*\}\}$/,
  /\b(?:process|import)\.env\b/,
  /^getenv\(/,
  /^@[A-Za-z0-9._-]+$/,
  // "your-key-here", "insert-token", "replace-me" style instructions.
  /^(?:your|my|insert|put|add|replace|change|set)[-_ ][A-Za-z0-9_-]*$/iu,
  // Type names and literals: `secret: string` is a type annotation, not a secret.
  /^(?:string|number|boolean|bigint|unknown|any|void|never|object|symbol|readonly|true|false|null|undefined|Promise|Record|Array|Map|Set|Buffer|Date|Error)$/u,
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const DIGEST = /^[0-9a-f]{32}$|^[0-9a-f]{40}$|^[0-9a-f]{64}$|^[0-9a-f]{128}$/iu;
const HEX_LIKE = /^[0-9a-f]+$/iu;
const BASE64_IMAGE = /^data:image\/|^iVBORw0KGgo|^\/9j\/|^R0lGOD/iu;
const URL = /^[a-z][a-z0-9+.-]*:\/\//iu;
const PATH_LIKE = /^(?:\.{0,2}\/|~\/|[A-Za-z]:\\|\/[\w.-]+\/)/u;
const SINGLE_CASE = /^[a-z]+$|^[A-Z]+$|^[0-9]+$/u;
const WORDY = /^[A-Za-z]+(?:[ ._-][A-Za-z]+){2,}$/u;
const COMMON_EXTENSION = /\.(?:json|ya?ml|toml|md|txt|js|ts|tsx|jsx|py|rb|go|rs|java|css|html|lock|map|svg)$/iu;
/**
 * Characters that never appear inside a real secret but show up constantly in code
 * (template interpolation, object literals, statements) and prose.
 */
const CODE_LIKE = /[(){}[\];<>`]|=>|\$\{|\$\(|\s/u;

/** Words that suggest the surrounding line really is about a secret. */
const SECRET_CONTEXT = /(?:key|token|secret|api|auth|pass|pwd|salt|hmac|credential|bearer|sign)/iu;

/**
 * Alphabets and sample lists (`ABCDEFGHIJKLMNOPQRSTUVWXYZ`, `0123456789abcdef`) have
 * long ascending or descending runs; real secrets practically never do.
 */
export function hasSequentialRun(text: string, minRun = 5): boolean {
  let ascending = 1;
  let descending = 1;
  for (let index = 1; index < text.length; index++) {
    const delta = text.charCodeAt(index) - text.charCodeAt(index - 1);
    ascending = delta === 1 ? ascending + 1 : 1;
    descending = delta === -1 ? descending + 1 : 1;
    if (ascending >= minRun || descending >= minRun) return true;
  }
  return false;
}

export interface EntropyOptions {
  threshold: number;
  minLength: number;
  maxLength: number;
}

export interface Candidate {
  value: string;
  index: number;
}

/** Why a candidate was rejected - exported for tests. */
export type RejectionReason = 'too-short' | 'too-long' | 'placeholder' | 'uuid' | 'digest' | 'image' | 'url' | 'path' | 'prose' | 'code' | 'weak';

export function classifyPlaceholder(value: string): RejectionReason | undefined {
  const text = value.trim();
  if (text.length === 0) return 'placeholder';
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(text)) return 'placeholder';
  }
  const lower = text.toLowerCase();
  if (PLACEHOLDER_WORDS.some((word) => lower.includes(word))) return 'placeholder';
  return undefined;
}

export function isUuidValue(value: string): boolean {
  return UUID.test(value.trim());
}

/**
 * Decide whether a candidate string is worth reporting as an unknown secret.
 * Returns undefined when it looks like a secret, or the reason it was skipped.
 */
export function entropyReason(value: string, options: EntropyOptions, line = ''): RejectionReason | undefined {
  const text = value.trim();
  if (text.length < options.minLength) return 'too-short';
  if (text.length > options.maxLength) return 'too-long';

  const placeholder = classifyPlaceholder(text);
  if (placeholder) return placeholder;
  // Images and UUIDs are checked before the code filter: base64 image data
  // contains ';' and would otherwise be mistaken for source code.
  if (BASE64_IMAGE.test(text)) return 'image';
  if (URL.test(text)) return 'url';
  if (UUID.test(text)) return 'uuid';
  if (CODE_LIKE.test(text)) return 'code';
  if (hasSequentialRun(text)) return 'prose';
  if (PATH_LIKE.test(text) || (COMMON_EXTENSION.test(text) && !SECRET_CONTEXT.test(line))) return 'path';
  if (DIGEST.test(text) && !SECRET_CONTEXT.test(line)) return 'digest';
  if (HEX_LIKE.test(text) && !SECRET_CONTEXT.test(line)) return 'digest';
  if (WORDY.test(text)) return 'prose';

  const entropy = shannonEntropy(text);
  // Single-case or single-symbol candidates need to look clearly random.
  const required = SINGLE_CASE.test(text) ? options.threshold + 0.8 : options.threshold;
  if (entropy < required) return 'weak';
  return undefined;
}

export function isEntropySecret(value: string, options: EntropyOptions, line = ''): boolean {
  return entropyReason(value, options, line) === undefined;
}

const QUOTED: readonly RegExp[] = [
  /"([^"\\\n]{8,200})"/gu,
  /'([^'\\\n]{8,200})'/gu,
  /`([^`\\\n]{8,200})`/gu,
];

const ASSIGNMENT = /[:=]\s*([A-Za-z0-9+/_\-.]{8,200})/gu;

/**
 * Candidate secrets on a line: quoted strings, plus bare assignment values.
 * Indexes are offsets into `line` so pattern matches can be deduplicated against them.
 */
export function extractCandidates(line: string): Candidate[] {
  const candidates: Candidate[] = [];
  const seen = new Set<number>();

  for (const pattern of QUOTED) {
    pattern.lastIndex = 0;
    for (;;) {
      const match = pattern.exec(line);
      if (match === null) break;
      const value = match[1];
      const index = match.index + match[0].indexOf(value);
      if (!seen.has(index)) {
        seen.add(index);
        candidates.push({ value, index });
      }
      if (match.index === pattern.lastIndex) pattern.lastIndex++;
    }
  }

  ASSIGNMENT.lastIndex = 0;
  for (;;) {
    const match = ASSIGNMENT.exec(line);
    if (match === null) break;
    const value = match[1];
    const index = match.index + match[0].indexOf(value);
    if (!seen.has(index)) {
      seen.add(index);
      candidates.push({ value, index });
    }
    if (match.index === ASSIGNMENT.lastIndex) ASSIGNMENT.lastIndex++;
  }

  return candidates;
}
