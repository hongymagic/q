# Feature: Shell Completions

## Overview

Generate shell completion scripts for bash, zsh, fish, and PowerShell via `q completions <shell>`.

## Use Cases

```bash
# Generate completions
q completions bash >> ~/.bashrc
q completions zsh >> ~/.zshrc
q completions fish > ~/.config/fish/completions/q.fish
q completions powershell >> $PROFILE

# After sourcing, users get:
q --pro<TAB>     # completes to --provider
q -p ant<TAB>    # completes to anthropic (from config)
q con<TAB>       # completes to config
```

## Design Decisions

### What to Complete

1. **Commands**: `config`, `providers`, `completions`
2. **Subcommands**: `config path`, `config init`
3. **Options**: `--provider`, `--model`, `--copy`, `--debug`, `--follow`, `--clear`, `--help`, `--version`
4. **Provider names**: Read from config at completion time (dynamic, bash/zsh/fish only)

### Completion Strategy

- Static completions for commands and options
- Dynamic completions for provider names (calls `q providers` at completion time)
- Keep scripts simple and maintainable

## Implementation

### New Files

#### `src/completions/index.ts`

```typescript
export type Shell = "bash" | "zsh" | "fish" | "powershell";

export function generateCompletions(shell: Shell): string {
  switch (shell) {
    case "bash":
      return generateBashCompletions();
    case "zsh":
      return generateZshCompletions();
    case "fish":
      return generateFishCompletions();
    case "powershell":
      return generatePowerShellCompletions();
  }
}

export function isValidShell(shell: string): shell is Shell {
  return ["bash", "zsh", "fish", "powershell"].includes(shell);
}
```

#### `src/completions/bash.ts`

```typescript
export function generateBashCompletions(): string {
  return `# q CLI bash completions
_q_completions() {
  local cur prev opts commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  commands="config providers completions"
  opts="--provider -p --model -m --copy --debug --follow -f --clear --help -h --version -v"

  case "\${prev}" in
    config)
      COMPREPLY=( \$(compgen -W "path init" -- "\${cur}") )
      return 0
      ;;
    completions)
      COMPREPLY=( \$(compgen -W "bash zsh fish powershell" -- "\${cur}") )
      return 0
      ;;
    --provider|-p)
      # Try to read providers from config
      local providers
      if command -v q &>/dev/null; then
        providers=\$(q providers 2>/dev/null | grep "^  " | awk '{print \$1}')
      fi
      COMPREPLY=( \$(compgen -W "\${providers}" -- "\${cur}") )
      return 0
      ;;
    --model|-m)
      # No completion for model (too many options)
      return 0
      ;;
  esac

  if [[ \${cur} == -* ]]; then
    COMPREPLY=( \$(compgen -W "\${opts}" -- "\${cur}") )
    return 0
  fi

  if [[ \${COMP_CWORD} == 1 ]]; then
    COMPREPLY=( \$(compgen -W "\${commands}" -- "\${cur}") )
    return 0
  fi
}

complete -F _q_completions q
`;
}
```

#### `src/completions/zsh.ts`

```typescript
export function generateZshCompletions(): string {
  return `#compdef q

_q() {
  local -a commands options

  commands=(
    'config:Manage configuration'
    'providers:List configured providers'
    'completions:Generate shell completions'
  )

  options=(
    '(-p --provider)'{-p,--provider}'[Override default provider]:provider:->providers'
    '(-m --model)'{-m,--model}'[Override default model]:model:'
    '--copy[Copy answer to clipboard]'
    '--debug[Enable debug logging]'
    '(-f --follow)'{-f,--follow}'[Continue previous conversation]'
    '--clear[Clear conversation history]'
    '(-h --help)'{-h,--help}'[Show help]'
    '(-v --version)'{-v,--version}'[Show version]'
  )

  _arguments -C \\
    "\${options[@]}" \\
    '1: :->command' \\
    '*::arg:->args'

  case "\$state" in
    command)
      _describe 'command' commands
      ;;
    providers)
      local -a providers
      providers=(\${(f)"\$(q providers 2>/dev/null | grep '^  ' | awk '{print \$1}')"})
      _describe 'provider' providers
      ;;
    args)
      case "\$words[1]" in
        config)
          _values 'subcommand' 'path[Print config path]' 'init[Create config]'
          ;;
        completions)
          _values 'shell' 'bash' 'zsh' 'fish' 'powershell'
          ;;
      esac
      ;;
  esac
}

_q "\$@"
`;
}
```

#### `src/completions/fish.ts`

```typescript
export function generateFishCompletions(): string {
  return `# q CLI fish completions

# Disable file completions
complete -c q -f

# Commands
complete -c q -n "__fish_use_subcommand" -a "config" -d "Manage configuration"
complete -c q -n "__fish_use_subcommand" -a "providers" -d "List configured providers"
complete -c q -n "__fish_use_subcommand" -a "completions" -d "Generate shell completions"

# Config subcommands
complete -c q -n "__fish_seen_subcommand_from config" -a "path" -d "Print config path"
complete -c q -n "__fish_seen_subcommand_from config" -a "init" -d "Create config"

# Completions subcommands
complete -c q -n "__fish_seen_subcommand_from completions" -a "bash zsh fish powershell"

# Options
complete -c q -s p -l provider -d "Override default provider" -xa "(q providers 2>/dev/null | string match -r '^\\s+\\S+' | string trim)"
complete -c q -s m -l model -d "Override default model"
complete -c q -l copy -d "Copy answer to clipboard"
complete -c q -l debug -d "Enable debug logging"
complete -c q -s f -l follow -d "Continue previous conversation"
complete -c q -l clear -d "Clear conversation history"
complete -c q -s h -l help -d "Show help"
complete -c q -s v -l version -d "Show version"
`;
}
```

#### `src/completions/powershell.ts`

```typescript
export function generatePowerShellCompletions(): string {
  return `# q CLI PowerShell completions

Register-ArgumentCompleter -Native -CommandName q -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)

  $commands = @('config', 'providers', 'completions')
  $configSubs = @('path', 'init')
  $shells = @('bash', 'zsh', 'fish', 'powershell')
  $options = @('--provider', '-p', '--model', '-m', '--copy', '--debug', '--follow', '-f', '--clear', '--help', '-h', '--version', '-v')

  $elements = $commandAst.CommandElements

  # Complete commands
  if ($elements.Count -eq 1) {
    $commands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
      [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
    return
  }

  # Complete config subcommands
  if ($elements[1].Extent.Text -eq 'config') {
    $configSubs | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
      [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
    return
  }

  # Complete completions shells
  if ($elements[1].Extent.Text -eq 'completions') {
    $shells | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
      [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
    return
  }

  # Complete options
  if ($wordToComplete -like '-*') {
    $options | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
      [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
    return
  }
}
`;
}
```

### Files to Modify

#### `src/args.ts`

```typescript
// Add completions command to Command type
export type Command = "query" | "config" | "providers" | "completions";

// Update parsing logic
if (firstArg === "completions") {
  const shell = positionals[1]?.toLowerCase();
  return {
    command: "completions",
    subcommand: shell,
    query: [],
    options,
  };
}

// Update HELP_TEXT
USAGE:
  q [options] <query...>       Ask a question
  q config path                Print config file path
  q config init                Create example config file
  q providers                  List configured providers
  q completions <shell>        Generate shell completions (bash, zsh, fish, powershell)
```

#### `src/cli.ts`

```typescript
import { generateCompletions, isValidShell } from "./completions/index.ts";

// Handle completions command (after config/providers handling)
if (args.command === "completions") {
  const shell = args.subcommand;
  if (!shell || !isValidShell(shell)) {
    throw new UsageError(
      `Invalid shell: '${shell ?? "(none)"}'\nValid shells: bash, zsh, fish, powershell`
    );
  }
  console.log(generateCompletions(shell));
  process.exit(0);
}
```

## Testing

#### `tests/completions.test.ts`

```typescript
describe("Shell completions", () => {
  describe("generateCompletions", () => {
    it("should generate valid bash completions");
    it("should generate valid zsh completions");
    it("should generate valid fish completions");
    it("should generate valid powershell completions");
  });

  describe("isValidShell", () => {
    it("should accept valid shell names");
    it("should reject invalid shell names");
  });
});

describe("CLI completions command", () => {
  it("should output bash completions");
  it("should output zsh completions");
  it("should output fish completions");
  it("should output powershell completions");
  it("should error on invalid shell");
  it("should error when shell not specified");
});
```

## Acceptance Criteria

- [ ] `q completions bash` outputs bash script
- [ ] `q completions zsh` outputs zsh script
- [ ] `q completions fish` outputs fish script
- [ ] `q completions powershell` outputs PowerShell script
- [ ] Invalid shell shows error with valid options
- [ ] Completions work after sourcing (manual verification)
- [ ] Provider names complete dynamically
- [ ] Tests pass
- [ ] AGENTS.md and README updated with completion instructions

## Effort Estimate

- Implementation: 2-3 hours
- Testing: 1 hour
- Documentation: 30 minutes
