# AGENTS.md

## Project: `q` — a Bun/TypeScript CLI for "quick AI answers"

`q` is a small CLI that takes a natural-language query (e.g., `q rewrite git history`) and prints a helpful, copy/paste-ready answer to stdout using Vercel's AI SDK.

---

## Quick Setup

```bash
bun install              # Install dependencies
bun run test             # Run tests
bun run test:coverage    # Run tests with coverage report
bun run typecheck        # Type check
bun run lint             # Check lint/format
bun run fix              # Auto-fix issues
bun run build            # Build for current platform
gh aw compile --validate # Compile and validate gh-aw workflows
bunx lefthook install    # Install pre-commit + pre-push hooks
```

---

## Gotchas

- The CLI blocks on stdin in non-interactive shells. Pipe empty input to avoid hangs: `echo "" | bun run src/cli.ts --help`
- Unit tests (`bun run test`) do **not** require any API keys. End-to-end LLM tests need `ANTHROPIC_API_KEY` or equivalent.

---

## Constraints

- Runtime: Bun
- Language: TypeScript (latest)
- Module system: ESM only (use `.ts` imports, not `.js`)
- Use Bun-native APIs where available (e.g., `Bun.TOML.parse`, `Bun.file()`)
- Type-safe env vars via `@t3-oss/env-core`
- Schema validation via Zod 4
- Node.js >=24 required for npm package

---

## CLI UX

### Commands

```
q [options] <query...>      # Run a query and print answer
q config path               # Print the resolved config file path
q config init               # Generate an optional config file
q config doctor             # Diagnose config and setup issues
q providers                 # List available providers + defaults/status
```

### Stdin/Pipe Support

| Scenario | stdin | args | Behaviour |
|----------|-------|------|-----------|
| `q how do I...` | empty | query | Normal: args = query |
| `cat log \| q "explain"` | content | query | Context mode: stdin = context, args = query |
| `echo "question" \| q` | content | none | Query mode: stdin = query |
| `q` (no input) | empty | none | Show help |

**Limits:** Query max 5,000 chars, context max 50,000 chars.

### Options

- `-p`, `--provider <name>`: override the configured provider
- `-m`, `--model <id>`: override the configured model
- `--mode <mode>`: output mode — `command` (default) or `explain`
- `--copy`: copy final answer to clipboard
- `--no-copy`: disable copy (overrides config)
- `--debug`: write debug logs to stderr
- `-h`, `--help`: show help
- `-v`, `--version`: show version

### I/O contract

- **stdout**: answer text (streamed)
- **stderr**: TTY loading indicator, logs, warnings, concise errors, and debug output
- **failure logs**: non-usage failures write a detailed log file to the platform log directory and print `Full log: <path>` on stderr
- **interactive recovery**: when stdin/stdout/stderr are TTYs, query failures offer `r` to retry, `Enter` to view the full log, and `q`/`Esc` to exit

---

## Config

### Resolution Order (Cascade Merge)

Config is optional. `q` starts with built-in provider presets and then applies overrides. Later sources override earlier ones:

1. **Built-in defaults**: common providers (`google`, `groq`, `anthropic`, `openai`, `ollama`, `azure`, `bedrock`) plus per-provider default models
2. **XDG config**: `$XDG_CONFIG_HOME/q/config.toml` or `~/.config/q/config.toml`
3. **CWD config**: `./config.toml` in current directory
4. **Environment variables**: `Q_PROVIDER`, `Q_MODEL`, `Q_COPY`

`q` auto-detects common provider keys (for example `GEMINI_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) and falls back to local Ollama when available.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `Q_PROVIDER` | Override default provider |
| `Q_MODEL` | Override default model |
| `Q_COPY` | Override default copy behaviour (true/false) |

### Env Var Interpolation

Support `${VAR_NAME}` syntax in specific fields for allowlisted variables only:
- `base_url`
- `headers` values
- `provider_slug` (Portkey-specific)

**Allowlisted variables:** `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `PORTKEY_API_KEY`, `PORTKEY_BASE_URL`, `PORTKEY_PROVIDER`, `GROQ_API_KEY`, `AZURE_API_KEY`, `AZURE_RESOURCE_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION`, `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, `HOME`, `USER`, `HOSTNAME`

### Schema (TOML)

```toml
[default]
provider = "google"           # Optional
# model = "gemini-2.5-flash"  # Optional

[providers.google]
type = "google"
api_key_env = "GEMINI_API_KEY"
```

Each provider entry requires `type`. Common built-in providers can run without any config file at all; custom providers still use optional fields like `api_key_env`, `base_url`, `headers`, and type-specific fields (see `ProviderConfig` below).

### Secrets

- Prefer `*_env` for API keys (env var names).
- Never log raw keys.

---

## Provider Abstraction

Implement a provider resolver:

```typescript
type ProviderConfig = {
  type: "openai" | "anthropic" | "openai_compatible" | "ollama" | "portkey" | "google" | "groq" | "azure" | "bedrock"
  model?: string                 // Per-provider default model (overridden by Q_MODEL and --model)
  api_key_env?: string
  base_url?: string
  headers?: Record<string, string>
  // Portkey-specific fields
  provider_slug?: string       // Maps to x-portkey-provider header
  provider_api_key_env?: string // Maps to Authorization: Bearer header
  // Azure-specific fields
  resource_name?: string       // Azure resource name
  api_version?: string         // Azure API version (defaults to 'v1')
  // Bedrock-specific fields
  region?: string              // AWS region (defaults to AWS_REGION)
  access_key_env?: string      // Custom env var for AWS access key
  secret_key_env?: string      // Custom env var for AWS secret key
}
```

Adapters:

- `openai` → `@ai-sdk/openai` (use `createOpenAI`, custom baseURL if present)
- `anthropic` → `@ai-sdk/anthropic`
- `openai_compatible` → `@ai-sdk/openai-compatible`
- `ollama` → `ollama-ai-provider-v2`
- `portkey` → `@ai-sdk/openai` (with Portkey-specific headers for internal/cloud gateways)
- `google` → `@ai-sdk/google` (Google Gemini models)
- `groq` → `@ai-sdk/groq` (ultra-fast Llama, Mixtral inference)
- `azure` → `@ai-sdk/azure` (Azure OpenAI deployments)
- `bedrock` → `@ai-sdk/amazon-bedrock` (AWS-native Claude, Titan, Llama)

Each adapter should expose a unified interface for `streamText`.

---

## Prompt Strategy

- System prompt: concise, command-first
- Always return actionable results
- Output plain text only (no markdown, no code fences, no backticks)
- Commands printed directly for easy copy/paste
- If destructive, use `WARNING:` prefix (no emojis)
- No auto execution

---

## Project Structure

```
src/
├── cli.ts              # Entrypoint
├── args.ts             # CLI argument parsing (util.parseArgs)
├── env.ts              # Type-safe env vars (@t3-oss/env-core)
├── env-info.ts         # Environment detection (OS, shell, terminal)
├── failure-prompt.ts   # Interactive retry/view-log prompt for TTY failures
├── loading-indicator.ts # TTY loading spinner while waiting for first output
├── logging.ts          # stderr logging + failure log writer
├── provider-catalog.ts # Built-in provider presets, defaults, and setup helpers
├── sensitive.ts        # Shared sensitive-key detection for redaction
├── stdin.ts            # Stdin/pipe input handling
├── config/
│   └── index.ts        # Config class, schemas, paths (consolidated)
├── providers/
│   ├── index.ts        # Provider factory
│   ├── openai.ts
│   ├── anthropic.ts
│   ├── openaiCompatible.ts
│   ├── ollama.ts
│   ├── portkey.ts      # Portkey AI Gateway provider
│   ├── google.ts       # Google Gemini provider
│   ├── groq.ts         # Groq provider
│   ├── azure.ts        # Azure OpenAI provider
│   └── bedrock.ts      # AWS Bedrock provider
├── run.ts              # AI execution (streamText)
├── prompt.ts           # System prompt builder (dynamic, env-aware)
└── errors.ts           # Typed errors + exit codes

scripts/
├── calver.ts           # CalVer utility functions
├── calver.test.ts      # Tests for CalVer utilities
└── release.ts          # Release script (creates CalVer tags)

.github/
├── CONSTITUTION.md         # Immutable governance rules for autonomous agents
├── EVOLUTION.md            # Living log of all autonomous changes and outcomes
├── PULL_REQUEST_TEMPLATE.md
├── copilot-instructions.md # Points to AGENTS.md
├── dependabot.yml
├── aw/
│   └── actions-lock.json   # Cached action pin resolutions from gh-aw compile
├── agents/
│   ├── security-hardener.agent.md
│   ├── feature-implementer.agent.md
│   ├── maintenance-keeper.agent.md
│   ├── performance-guardian.agent.md
│   ├── coverage-expander.agent.md
│   └── usability-reviewer.agent.md
├── skills/
│   ├── security-patch/SKILL.md
│   ├── feature-delivery/SKILL.md
│   ├── maintenance-update/SKILL.md
│   ├── performance-fix/SKILL.md
│   ├── coverage-expansion/SKILL.md
│   └── usability-fix/SKILL.md
└── workflows/
    ├── ci.yml
    ├── release.yml
    ├── deps-update.yml
    ├── deps-update-copilot.yml
    ├── agentics-maintenance.yml
    ├── security-daily.md          # Daily security scan
    ├── feature-daily.md           # Daily feature gap detection
    ├── maintenance-daily.md       # Daily maintenance scan
    ├── self-improve-weekly.md     # Weekly quality retrospective
    ├── performance-weekly.md      # Weekly performance audit
    ├── coverage-weekly.md         # Weekly test coverage expansion
    ├── usability-weekly.md        # Weekly CLI UX review
    ├── self-evolve-fortnightly.md # Meta-agent: improves agents themselves
    └── *.lock.yml                 # Compiled gh-aw workflow lock files
```

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `ai` | Vercel AI SDK core |
| `@ai-sdk/openai` | OpenAI provider |
| `@ai-sdk/anthropic` | Anthropic provider |
| `@ai-sdk/openai-compatible` | OpenAI-compatible provider |
| `ollama-ai-provider-v2` | Ollama provider |
| `@ai-sdk/google` | Google Gemini provider |
| `@ai-sdk/groq` | Groq provider |
| `@ai-sdk/azure` | Azure OpenAI provider |
| `@ai-sdk/amazon-bedrock` | AWS Bedrock provider |
| `zod` | Schema validation (v4) |
| `clipboardy` | Clipboard support |
| `env-paths` | Cross-platform log directory resolution |
| `picocolors` | Lightweight stderr colour formatting |
| `@t3-oss/env-core` | Type-safe env vars |
| `vitest` | Test runner (dev) |
| `@vitest/coverage-v8` | V8 code coverage reporter (dev) |
| `@biomejs/biome` | Linter + formatter (dev) |
| `lefthook` | Git hooks runner (dev) |

---

## Build

### Scripts

```bash
bun run build              # Build for current platform
bun run build:npm          # Build Node.js-compatible bundle for npm
bun run build:all          # Build for all platforms
```

### Targets

- `bun-darwin-arm64` (macOS Apple Silicon)
- `bun-darwin-x64` (macOS Intel)
- `bun-linux-x64` (Linux x64)
- `bun-linux-arm64` (Linux ARM64)
- `bun-windows-x64` (Windows x64)

Output: `dist/q-<platform>`

---

## npm Publishing

Published as `@hongymagic/q` (`npm install -g @hongymagic/q`). Binary installs as `q`.

### Release Process

**CalVer** format: `YYYY.MMDD.PATCH` (e.g., `2026.0226.0`).

- **Stable releases**: Automated via `release.yml` (daily at 00:00 UTC or manual `workflow_dispatch`). Builds binaries, creates GitHub Release, publishes to npm `@latest`.
- **Pre-releases**: Every push to `main` publishes `YYYY.MMDD.PATCH-next.{short-sha}` to npm `@next`.
- **Manual release**: `bun run release` (interactive) or `bun run release:dry` (preview).

---

## Dependency Updates

- **Deterministic** (`deps-update.yml`): Daily at 00:00 UTC. Runs `npx npm-check-updates -u` + `bun install`, creates/updates PR on `deps/automated-update`.
- **Copilot handoff** (`deps-update-copilot.yml`): Manual trigger. Creates an issue and assigns `@copilot`.
- **Agentic** (`gh-aw`): Daily workflows (`security-daily.md`, `feature-daily.md`, `maintenance-daily.md`) + weekly (`self-improve-weekly.md`, `performance-weekly.md`, `coverage-weekly.md`, `usability-weekly.md`) + fortnightly (`self-evolve-fortnightly.md`). Source in `.github/workflows/`, compiled to `.lock.yml`. Run `gh aw compile --validate` after frontmatter changes.
  - Required secrets: `COPILOT_GITHUB_TOKEN`, `GH_AW_AGENT_TOKEN`
  - All workflows enforce a plan-first gate before implementation.

---

## Self-Evolving System

`q` includes an autonomous improvement system powered by GitHub Agentic Workflows (gh-aw). AI agents continuously scan, assess, and improve the codebase across multiple dimensions.

### Agent Schedule

| Agent | Schedule | Purpose | PR Prefix |
|-------|----------|---------|-----------|
| Security Daily | Daily 00:11 UTC | Scan and fix security vulnerabilities | `[security]` |
| Feature Daily | Daily 00:23 UTC | Detect and implement feature gaps | `[feature]` |
| Maintenance Daily | Daily 00:37 UTC | Fix dead code, test gaps, docs drift | `[maintenance]` |
| Self Improve Weekly | Mon 01:10 UTC | Retrospective on PR quality patterns | `[quality]` |
| Performance Weekly | Tue 01:10 UTC | Binary size, speed, memory optimisation | `[perf]` |
| Coverage Weekly | Wed 01:10 UTC | Expand test coverage for low-coverage modules | `[coverage]` |
| Usability Weekly | Thu 01:10 UTC | CLI UX, error messages, help text, Australian English | `[ux]` |
| Self Evolve Fortnightly | 1st & 15th 02:00 UTC | Meta-agent: improve agent prompts and skills | `[evolve]` |

### Governance

All autonomous agents are governed by `.github/CONSTITUTION.md`:

- All agent PRs are **draft** and require **human approval** to merge
- Each agent has a **declared scope** — it may only modify files within that scope
- **Copilot** is assigned as reviewer on all agent PRs
- **Threat detection** runs as a second pass on all agent outputs
- Agents run in a **sandboxed environment** with network firewall and tool allowlists
- Max **1 PR per agent per run**; stale PRs **auto-expire** after 14 days

### Evolution Tracking

All autonomous changes are logged in `.github/EVOLUTION.md`. The Self Evolve Fortnightly agent uses this log to assess agent effectiveness and propose improvements to agent prompts and skills.

### Agent Definitions & Skills

Each agent has a persona definition (`.github/agents/*.agent.md`) and a corresponding skill checklist (`.github/skills/*/SKILL.md`). These define the agent's focus areas, planning requirements, implementation guidelines, and quality bar.

---

## Tests

Use **vitest** (not Bun's test runner). Test files live in `tests/` and `scripts/`. Coverage is reported for `src/**` (excluding `src/cli.ts`). Unit tests do **not** require any API keys.

```bash
bun run test             # Run all tests once
bun run test:coverage    # Run tests with v8 coverage report
bun run test:watch       # Watch mode for development
```

---

## Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting.

`biome.jsonc` should reference the local schema file (`./node_modules/@biomejs/biome/configuration_schema.json`) to avoid CLI/schema version drift warnings.

```bash
bun run lint        # Check for issues (used in CI)
bun run fix         # Fix all auto-fixable issues (lint + format)
```

### Pre-commit / Pre-push Hooks

[Lefthook](https://github.com/evilmartians/lefthook) runs checks automatically:

- **pre-commit**: Biome check on staged `.ts/.js/.json/.jsonc` files
- **pre-push**: `bun run typecheck` + `bun run test`

To install hooks after cloning:

```bash
bunx lefthook install
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Runtime/provider error |
| 2 | Usage/config error |

---

## Operational Safeguards

- **Never execute model output automatically**
- **Do not send local files or environment vars without explicit intent**
- **Secrets must be redacted in logs**
- **Keep stdout pure** (answer text only)


## Keeping AGENTS.md Up-to-Date

**IMPORTANT**: When making changes to the project that affect:

- Project structure (adding/removing/renaming files or directories)
- Scripts in `package.json`
- Dependencies (adding/removing packages)
- Configuration files (biome, lefthook, tsconfig, etc.)
- CLI commands or options
- Build targets or processes
- Testing approach or test structure
- Any documented conventions or patterns

You MUST update this file to reflect those changes. This file serves as the authoritative source of truth for AI agents and developers working on this project.

### What to Update

1. **Project Structure**: Update the tree diagram in the "Project Structure" section
2. **Scripts**: Update the "Linting & Formatting" or "Build" sections
3. **Dependencies**: Update the "Key Dependencies" table
4. **CLI Changes**: Update the "CLI UX" section (commands, options)
5. **Config Changes**: Update the "Config" section
6. **README.md**: Update user-facing documentation (see below)

### Keeping README.md in Sync

The README.md is the user-facing documentation. Update it when:

- **New providers added**: Update the "Provider Types" table
- **New CLI options added**: Update the "Options" table
- **New commands added**: Update the "Commands" section
- **Configuration changes**: Update the "Configuration" section
- **New features**: Add usage examples if user-visible

Keep README.md concise - it should be a quick-start guide, not comprehensive docs.

---

## Code Style Guidelines

### Australian English

Use Australian/British English spellings in documentation and user-facing strings (e.g., behaviour, colour, initialise, organise, centre, favour, licence). **Exception**: Technical identifiers like `xterm-256color` remain unchanged.

### Comments

- **No verbose JSDoc** that merely restates the function name
- **No module headers** explaining what the module does
- **Self-documenting code**: prefer clear naming over comments
- **Only comment the "why"**: non-obvious logic or business decisions

### General Style

- Prefer early returns over nested conditionals
- Use TypeScript's type system; avoid `any`
- Descriptive but not verbose naming

---

## Git Conventions

### Conventional Commits (REQUIRED)

**Format:** `<type>(<scope>): <description>`

| Type | Use for |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change, no new feature/fix |
| `test` | Adding/updating tests |
| `chore` | Build, config, dependencies |
| `perf` | Performance improvement |

**Scope** (optional): `cli`, `config`, `providers`, `stdin`, `deps`

### Pull Requests

- **Title**: Use conventional commit format
- **Pre-push**: `bun run test && bun run lint`
- **Scope**: One logical change per PR
