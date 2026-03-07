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
q config init               # Generate an example config file
q providers                 # List configured providers + default
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

Config is loaded from multiple sources. Later sources override earlier ones:

1. **XDG config**: `$XDG_CONFIG_HOME/q/config.toml` or `~/.config/q/config.toml`
2. **CWD config**: `./config.toml` in current directory
3. **Environment variables**: `Q_PROVIDER`, `Q_MODEL`, `Q_COPY`

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

**Allowlisted variables:** `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `PORTKEY_API_KEY`, `PORTKEY_BASE_URL`, `PORTKEY_PROVIDER`, `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, `HOME`, `USER`, `HOSTNAME`

### Schema (TOML)

```toml
[default]
provider = "anthropic"
model = "claude-sonnet-4-20250514"

[providers.anthropic]
type = "anthropic"
api_key_env = "ANTHROPIC_API_KEY"
```

Each provider entry requires `type` and typically `api_key_env`. Optional fields: `base_url`, `headers`, and type-specific fields (see `ProviderConfig` below).

### Secrets

- Prefer `*_env` for API keys (env var names).
- Never log raw keys.

---

## Provider Abstraction

Implement a provider resolver:

```typescript
type ProviderConfig = {
  type: "openai" | "anthropic" | "openai_compatible" | "ollama" | "portkey" | "google" | "groq" | "azure" | "bedrock"
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
├── copilot-instructions.md # Points to AGENTS.md
├── aw/
│   └── actions-lock.json   # Cached action pin resolutions from gh-aw compile
├── agents/
│   ├── security-hardener.agent.md
│   ├── feature-implementer.agent.md
│   └── maintenance-keeper.agent.md
├── skills/
│   ├── security-patch/SKILL.md
│   ├── feature-delivery/SKILL.md
│   └── maintenance-update/SKILL.md
└── workflows/
    ├── ci.yml
    ├── release.yml
    ├── deps-update.yml
    ├── deps-update-copilot.yml
    ├── security-daily.md
    ├── feature-daily.md
    ├── maintenance-daily.md
    ├── self-improve-weekly.md
    └── *.lock.yml       # Compiled gh-aw workflow lock files
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
- **Agentic** (`gh-aw`): Daily workflows (`security-daily.md`, `feature-daily.md`, `maintenance-daily.md`) + weekly (`self-improve-weekly.md`). Source in `.github/workflows/`, compiled to `.lock.yml`. Run `gh aw compile --validate` after frontmatter changes.
  - Required secrets: `COPILOT_GITHUB_TOKEN`, `GH_AW_AGENT_TOKEN`
  - All workflows enforce a plan-first gate before implementation.

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
