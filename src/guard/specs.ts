import type { FlagSpec } from '../flags.js';

/**
 * Flags used by `mint guard`. Registered in the global spec map so the hand-rolled
 * parser can recognise them; each guard subcommand declares which ones it accepts.
 */
export const GUARD_FLAGS: readonly FlagSpec[] = [
  { name: 'staged', type: 'boolean', description: 'Scan the git index instead of the working tree' },
  { name: 'history', type: 'boolean', description: 'Scan every commit and diff' },
  { name: 'since', type: 'string', arg: '<rev|date>', description: 'Limit --history to a revision or a date' },
  {
    name: 'fail-on',
    type: 'string',
    arg: '<severity>',
    description: 'Exit 1 when a finding is at least this severe (low, medium, high, critical)',
    default: 'medium',
  },
  {
    name: 'entropy-threshold',
    type: 'string',
    arg: '<bits>',
    description: 'Entropy threshold in bits per character',
    default: 4.5,
  },
  {
    name: 'max-file-size',
    type: 'size',
    arg: '<n>',
    description: 'Skip files larger than this (k/m suffixes allowed)',
    default: '1mb',
  },
  { name: 'include-lockfiles', type: 'boolean', description: 'Scan lockfiles too (they are skipped by default)' },
  {
    name: 'gitignore',
    type: 'boolean',
    shownAs: '--no-gitignore',
    description: 'Respect .gitignore and .mintguardignore',
    default: true,
  },
  {
    name: 'baseline',
    type: 'boolean',
    shownAs: '--no-baseline',
    description: 'Ignore findings recorded in the baseline file',
    default: true,
  },
  {
    name: 'baseline-file',
    type: 'string',
    arg: '<path>',
    description: 'Baseline file to read or write',
    default: '.mintguard-baseline.json',
  },
  { name: 'config', type: 'string', arg: '<path>', description: 'Config file to use', default: '.mintguard.json' },
  { name: 'rules', type: 'string', arg: '<id,id>', description: 'Only run these rule ids' },
  { name: 'fix', type: 'boolean', description: 'Print the remediation plan (never edits files)' },
  { name: 'quiet', type: 'boolean', description: 'Suppress progress output' },
  { name: 'force', type: 'boolean', description: 'Overwrite files or append to an existing hook' },
  {
    name: 'inline-comments',
    type: 'boolean',
    shownAs: '--no-inline-comments',
    description: 'Honor mintguard:ignore comments',
    default: true,
  },
];
