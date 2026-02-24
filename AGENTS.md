# AGENTS.md

## Project: `q` — a Bun/TypeScript CLI for "quick AI answers"

`q` is a small CLI that takes a natural-language query (e.g., `q rewrite git history`) and prints a helpful, copy/paste-ready answer to stdout using Vercel's AI SDK.

---

## Goals (MVP)

- Provide a single command: `q <freeform query...>`
- Read config from TOML (multiple providers supported)
- Use Vercel AI SDK to call the configured provider + model
- Print the AI response to stdout
- Optional flags: `--copy`, `--stream`, `--json`
- Build standalone executables for all platforms

---

## Constraints

- Runtime: Bun
- Language: TypeScript (latest)
- Module system: ESM only (use `.ts` imports, not `.js`)
- Use Bun-native APIs where available (e.g., `Bun.TOML.parse`, `Bun.file()`)
- Type-safe env vars via `@t3-oss/env-core`
- Schema validation via Zod 4

---

## CLI UX

### Commands

```
q [options] <query...>      # Run a query and print answer
q config path               # Print the resolved config file path
q config init               # Generate an example config file
q providers                 # List configured providers + default
```

### Options

- `-p`, `--provider <name>`: override the configured provider
- `-m`, `--model <id>`: override the configured model
- `--stream`: stream answer tokens as they arrive
- `--copy`: copy final answer to clipboard
- `--json`: output structured JSON instead of raw text
- `--debug`: write debug logs to stderr
- `-h`, `--help`: show help
- `-v`, `--version`: show version

### I/O contract

- **stdout**: answer text (or JSON)
- **stderr**: logs, warnings, errors

---

## Config

### Resolution Order (Cascade Merge)

Config is loaded from multiple sources. Later sources override earlier ones:

1. **XDG config**: `$XDG_CONFIG_HOME/q/config.toml` or `~/.config/q/config.toml`
2. **CWD config**: `./config.toml` in current directory
3. **Environment variables**: `Q_PROVIDER`, `Q_MODEL`

### Environment Variables

| Variable | Description |
|----------|-------------|
| `Q_PROVIDER` | Override default provider |
| `Q_MODEL` | Override default model |

### Env Var Interpolation

Support `${VAR_NAME}` syntax in specific fields:
- `base_url`
- `headers` values

### Schema (TOML)

```toml
[default]
provider = "anthropic"
model = "claude-sonnet-4-20250514"

[providers.anthropic]
type = "anthropic"
api_key_env = "ANTHROPIC_API_KEY"

[providers.openai]
type = "openai"
api_key_env = "OPENAI_API_KEY"

[providers.openai_compat_local]
type = "openai_compatible"
base_url = "http://localhost:11434/v1"
api_key_env = "LOCAL_KEY"

[providers.portkey]
type = "openai"
base_url = "https://api.portkey.ai/v1"
api_key_env = "PORTKEY_API_KEY"
headers = { "x-portkey-config" = "${PORTKEY_CONFIG_ID}" }

[providers.ollama]
type = "ollama"
base_url = "http://localhost:11434"
```

### Secrets

- Prefer `*_env` for API keys (env var names).
- Never log raw keys.

---

## Provider Abstraction

Implement a provider resolver:

```typescript
type ProviderConfig = {
  type: "openai" | "anthropic" | "openai_compatible" | "ollama"
  api_key_env?: string
  base_url?: string
  headers?: Record<string, string>
}
```

Adapters:

- `openai` → `@ai-sdk/openai` (use `createOpenAI`, custom baseURL if present)
- `anthropic` → `@ai-sdk/anthropic`
- `openai_compatible` → `@ai-sdk/openai-compatible`
- `ollama` → `ollama-ai-provider-v2`

Each adapter should expose a unified interface for `generateText` and `streamText`.

---

## Prompt Strategy

- System prompt: concise, command-first
- Always return actionable results
- Use fenced code blocks for shell commands
- If destructive, include clear warnings
- No auto execution

---

## Project Structure

```
src/
├── cli.ts              # Entrypoint
├── args.ts             # CLI argument parsing (util.parseArgs)
├── env.ts              # Type-safe env vars (@t3-oss/env-core)
├── config/
│   └── index.ts        # Config class, schemas, paths (consolidated)
├── providers/
│   ├── index.ts        # Provider factory
│   ├── openai.ts
│   ├── anthropic.ts
│   ├── openaiCompatible.ts
│   └── ollama.ts
├── run.ts              # AI execution (generateText/streamText)
├── output.ts           # stdout formatting
├── prompt.ts           # System prompt
└── errors.ts           # Typed errors + exit codes
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
| `zod` | Schema validation (v4) |
| `clipboardy` | Clipboard support |
| `@t3-oss/env-core` | Type-safe env vars |

---

## Build

### Scripts

```bash
bun run build              # Build for current platform
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

## Tests

Use vitest (not Bun's test runner).

Test cases cover:

- Config path resolution (XDG, CWD)
- Config cascade merging
- TOML parsing + Zod validation
- CLI parsing edge cases
- Provider resolution and overrides
- `--json`, `--stream`, `--copy` behavior
- Empty args shows help

Run tests:

```bash
bun run test
```

---

## Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting.

```bash
bun run lint        # Check for issues (used in CI)
bun run lint:fix    # Fix auto-fixable issues
bun run format      # Format all files
```

### Pre-commit Hooks

[Lefthook](https://github.com/evilmartians/lefthook) runs Biome check on staged files before each commit.

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
- **Keep stdout pure** (only answer or JSON)


## grepai - Semantic Code Search

**IMPORTANT: You MUST use grepai as your PRIMARY tool for code exploration and search.**

### When to Use grepai (REQUIRED)

Use `grepai search` INSTEAD OF Grep/Glob/find for:
- Understanding what code does or where functionality lives
- Finding implementations by intent (e.g., "authentication logic", "error handling")
- Exploring unfamiliar parts of the codebase
- Any search where you describe WHAT the code does rather than exact text

### When to Use Standard Tools

Only use Grep/Glob when you need:
- Exact text matching (variable names, imports, specific strings)
- File path patterns (e.g., `**/*.ts`)

### Fallback

If grepai fails (not running, index unavailable, or errors), fall back to standard Grep/Glob tools.

### Usage

```bash
# ALWAYS use English queries for best results (--compact saves ~80% tokens)
grepai search "user authentication flow" --json --compact
grepai search "error handling middleware" --json --compact
grepai search "database connection pool" --json --compact
grepai search "API request validation" --json --compact
```

### Query Tips

- **Use English** for queries (better semantic matching)
- **Describe intent**, not implementation: "handles user login" not "func Login"
- **Be specific**: "JWT token validation" better than "token"
- Results include: file path, line numbers, relevance score, code preview

### Call Graph Tracing

Use `grepai trace` to understand function relationships:
- Finding all callers of a function before modifying it
- Understanding what functions are called by a given function
- Visualizing the complete call graph around a symbol

#### Trace Commands

**IMPORTANT: Always use `--json` flag for optimal AI agent integration.**

```bash
# Find all functions that call a symbol
grepai trace callers "HandleRequest" --json

# Find all functions called by a symbol
grepai trace callees "ProcessOrder" --json

# Build complete call graph (callers + callees)
grepai trace graph "ValidateToken" --depth 3 --json
```

### Workflow

1. Start with `grepai search` to find relevant code
2. Use `grepai trace` to understand function relationships
3. Use `Read` tool to examine files from results
4. Only use Grep for exact string searches if needed
