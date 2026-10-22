import { UsageError } from './errors.js';
import { GUARD_COMMANDS } from './guard/commands.js';
import { GENERATORS } from './registry.js';
import { TOOLS } from './catalog.js';

/** Shell completion scripts, generated from the live command registry. */

export const SHELLS = ['bash', 'zsh', 'fish', 'powershell'] as const;
export type Shell = (typeof SHELLS)[number];

export function isShell(value: string): value is Shell {
  return (SHELLS as readonly string[]).includes(value);
}

function topLevelCommands(): string[] {
  return [...GENERATORS.map((generator) => generator.name), 'guard', 'help', ...TOOLS.map((tool) => tool.name)].sort();
}

function guardCommands(): string[] {
  return GUARD_COMMANDS.map((command) => command.name).sort();
}

function words(values: readonly string[]): string {
  return values.join(' ');
}

export function renderCompletions(shell: Shell): string {
  const commands = topLevelCommands();
  const guard = guardCommands();

  switch (shell) {
    case 'bash':
      return [
        '# mint completions for bash',
        '# load with: source <(mint completions bash)',
        '_mint_complete() {',
        '  local cur="${COMP_WORDS[COMP_CWORD]}"',
        `  local commands="${words(commands)}"`,
        `  local guard_commands="${words(guard)}"`,
        '  if [ "$COMP_CWORD" -eq 1 ]; then',
        '    COMPREPLY=( $(compgen -W "$commands" -- "$cur") )',
        '  elif [ "$COMP_CWORD" -eq 2 ] && [ "${COMP_WORDS[1]}" = "guard" ]; then',
        '    COMPREPLY=( $(compgen -W "$guard_commands" -- "$cur") )',
        '  fi',
        '}',
        'complete -F _mint_complete mint',
        '',
      ].join('\n');

    case 'zsh':
      return [
        '#compdef mint',
        '# mint completions for zsh',
        '# load with: mint completions zsh > "${fpath[1]}/_mint"',
        '_mint() {',
        '  local -a commands guard_commands',
        `  commands=(${words(commands)})`,
        `  guard_commands=(${words(guard)})`,
        '  if (( CURRENT == 2 )); then',
        '    compadd -a commands',
        '  elif (( CURRENT == 3 )) && [[ $words[2] == guard ]]; then',
        '    compadd -a guard_commands',
        '  fi',
        '}',
        '_mint "$@"',
        '',
      ].join('\n');

    case 'fish':
      return [
        '# mint completions for fish',
        '# load with: mint completions fish > ~/.config/fish/completions/mint.fish',
        'complete -c mint -f',
        `complete -c mint -n '__fish_use_subcommand' -a '${words(commands)}'`,
        `complete -c mint -n '__fish_seen_subcommand_from guard' -a '${words(guard)}'`,
        '',
      ].join('\n');

    case 'powershell': {
      const quoted = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ');
      return [
        '# mint completions for PowerShell',
        '# add to your profile: mint completions powershell | Out-File -Append $PROFILE',
        'Register-ArgumentCompleter -Native -CommandName mint -ScriptBlock {',
        '    param($wordToComplete, $commandAst, $cursorPosition)',
        `    $commands = @(${quoted(commands)})`,
        `    $guardCommands = @(${quoted(guard)})`,
        '    $elements = $commandAst.CommandElements',
        '    $candidates = $commands',
        "    if ($elements.Count -ge 2 -and $elements[1].Value -eq 'guard') { $candidates = $guardCommands }",
        '    $candidates | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {',
        "        [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)",
        '    }',
        '}',
        '',
      ].join('\n');
    }
  }
}

export function resolveShell(value: string | undefined): Shell {
  if (value === undefined || value === '') {
    throw new UsageError('completions needs a shell', `supported shells: ${SHELLS.join(', ')}`);
  }
  const normalized = value.toLowerCase();
  if (!isShell(normalized)) {
    throw new UsageError(`unknown shell "${value}"`, `supported shells: ${SHELLS.join(', ')}`);
  }
  return normalized;
}
