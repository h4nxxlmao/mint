import { createHash, randomBytes } from 'node:crypto';

/**
 * Redaction. Nothing in mint guard ever writes a full secret to stdout, a report,
 * a baseline file or a log: findings only carry the preview produced here.
 */

/** Secrets shorter than this are never partially revealed. */
export const MIN_PREVIEWABLE = 12;

const FULLY_HIDDEN = '***';

/**
 * First four characters, an ellipsis, then the last two - or a fixed mask when the
 * value is too short for a partial reveal to be safe.
 */
export function previewSecret(secret: string): string {
  const value = secret.trim();
  if (value.length < MIN_PREVIEWABLE) return FULLY_HIDDEN;
  return `${value.slice(0, 4)}...${value.slice(-2)}`;
}

/** True when `text` does not contain the raw secret. */
export function isRedacted(text: string, secret: string): boolean {
  const value = secret.trim();
  return value.length === 0 || !text.includes(value);
}

function hashString(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * A stable, salted identifier for a finding. The salt lives in the baseline file, so
 * the hash cannot be compared against a table of known secrets without that file.
 */
export function findingHash(salt: string, ruleId: string, file: string, secret: string): string {
  return hashString(`${salt}\u0000${ruleId}\u0000${file}\u0000${secret.trim()}`).slice(0, 16);
}

/** Short display id: `<rule-id>-<8 hex of a digest>`. */
export function findingId(ruleId: string, file: string, line: number, secret: string): string {
  const digest = hashString(`${ruleId}\u0000${file}\u0000${String(line)}\u0000${secret.trim()}`);
  return `${ruleId}-${digest.slice(0, 8)}`;
}

/** Random salt for a new baseline file. */
export function newSalt(bytes = 16): string {
  return randomBytes(bytes).toString('base64');
}
