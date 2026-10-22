import { UsageError } from './errors.js';
import type { Flags } from './flags.js';
import { GUARD_COMMANDS } from './guard/commands.js';
import { CATEGORIES } from './registry.js';
import { VERSION } from './version.js';

/** Non-generator commands that ship with mint. */
export interface ToolCommand {
  name: string;
  summary: string;
  usage: string;
  details?: readonly string[];
  examples: readonly string[];
}

export const TOOLS: readonly ToolCommand[] = [
  {
    name: 'list',
    summary: 'Print every generator and guard command as text or JSON',
    usage: 'list [--json]',
    details: ['Useful for scripts, editor plugins and building your own completions.'],
    examples: ['mint list', 'mint list --json'],
  },
  {
    name: 'completions',
    summary: 'Print a shell completion script',
    usage: 'completions <bash|zsh|fish|powershell>',
    details: ['Write the output into your shell profile or completion directory.'],
    examples: [
      'mint completions bash >> ~/.bashrc',
      'mint completions zsh > ~/.zsh/completions/_mint',
      'mint completions fish > ~/.config/fish/completions/mint.fish',
      'mint completions powershell | Out-File -Append $PROFILE',
    ],
  },
  {
    name: 'doctor',
    summary: 'Check the environment: CSPRNG, git, clipboard and config',
    usage: 'doctor [--json]',
    details: ['Exits 1 when a required check fails (Node version or the CSPRNG).'],
    examples: ['mint doctor', 'mint doctor --json'],
  },
];

export function findTool(name: string): ToolCommand | undefined {
  return TOOLS.find((tool) => tool.name === name);
}

export interface CatalogEntry {
  name: string;
  summary: string;
  usage: string;
  examples: readonly string[];
  flags: readonly string[];
}

function entryOf(generator: { name: string; summary: string; usage?: string; examples?: readonly string[]; flags?: readonly string[] }): CatalogEntry {
  return {
    name: generator.name,
    summary: generator.summary,
    usage: generator.usage ?? generator.name,
    examples: generator.examples ?? [],
    flags: generator.flags ?? [],
  };
}

export interface Catalog {
  version: string;
  generators: CatalogEntry[];
  guard: CatalogEntry[];
  tools: CatalogEntry[];
}

export function buildCatalog(): Catalog {
  return {
    version: VERSION,
    generators: CATEGORIES.flatMap((category) => category.generators.map(entryOf)),
    guard: GUARD_COMMANDS.map(entryOf),
    tools: TOOLS.map(entryOf),
  };
}

/** `--json` or `--format text|json`, shared by the tool commands. */
export function resolveToolFormat(flags: Flags): 'text' | 'json' {
  const raw = flags.getString('format');
  if (raw !== undefined && raw !== '') {
    const normalized = raw.toLowerCase();
    if (normalized !== 'text' && normalized !== 'json') {
      throw new UsageError(`--format must be text or json (got "${raw}")`);
    }
    return normalized;
  }
  return flags.getBool('json') ? 'json' : 'text';
}

export function renderCatalog(format: 'text' | 'json'): string {
  const catalog = buildCatalog();
  if (format === 'json') return `${JSON.stringify(catalog, null, 2)}\n`;

  const width = Math.max(...catalog.generators.map((entry) => entry.name.length)) + 2;
  const lines: string[] = [`mint ${catalog.version}`, ''];
  for (const category of CATEGORIES) {
    lines.push(category.title);
    for (const generator of category.generators) {
      lines.push(`  ${generator.name.padEnd(width)}${generator.summary}`);
    }
    lines.push('');
  }
  lines.push('guard');
  for (const command of catalog.guard) {
    lines.push(`  ${command.name.padEnd(width)}${command.summary}`);
  }
  lines.push('');
  lines.push('tools');
  for (const tool of catalog.tools) {
    lines.push(`  ${tool.name.padEnd(width)}${tool.summary}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}
