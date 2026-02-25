# AGENTS.md

## Project: `q` — a Bun/TypeScript CLI for "quick AI answers"

`q` is a small CLI that takes a natural-language query (e.g., `q rewrite git history`) and prints a helpful, copy/paste-ready answer to stdout using Vercel's AI SDK.

---

## Goals (MVP)

- Provide a single command: `q <freeform query...>`
- Read config from TOML (multiple providers supported)
- Use Vercel AI SDK to call the configured provider + model
- Print the AI response to stdout
- Optional flags: `--copy`
- Build standalone executables for all platforms

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

`q` supports reading from stdin for flexible workflows:

```bash
# Pipe content as context with a question
cat error.log | q "what's wrong here?"
git diff | q "summarise these changes"
pbpaste | q "explain this code"

# Pipe query itself (no arguments)
echo "how do I restart docker" | q

# Heredoc for multiline context
q "explain this function" << 'EOF'
function fibonacci(n) {
  return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2);
}
EOF
```

**Input modes:**
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
- **stderr**: logs, warnings, errors

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
# copy = true  # Always copy answer to clipboard (override with --no-copy)

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

[providers.portkey_internal]
type = "portkey"
base_url = "https://your-portkey-gateway.internal/v1"
provider_slug = "@your-org/bedrock-provider"
api_key_env = "PORTKEY_API_KEY"
provider_api_key_env = "PROVIDER_API_KEY"
headers = { "x-portkey-trace-id" = "${HOSTNAME}" }

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
| `@t3-oss/env-core` | Type-safe env vars |

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

The package is published to npm as `@hongymagic/q`. Users install with:

```bash
npm install -g @hongymagic/q
```

The binary is installed as `q`, so usage remains:

```bash
q "how do I rewrite git history"
```

### Release Process

Releases are automated via GitHub Actions using npm Trusted Publishers (OIDC). To publish a new version:

1. Update version in `package.json`
2. Commit: `git commit -am "chore: bump version to X.Y.Z"`
3. Tag: `git tag vX.Y.Z`
4. Push: `git push && git push --tags`

The release workflow will:
- Build standalone binaries for all platforms
- Create a GitHub Release with binaries attached
- Publish the package to npm with provenance attestation

### Trusted Publisher Setup (One-Time)

No secrets required. Instead, configure npm to trust this GitHub repository:

1. Go to [npmjs.com](https://www.npmjs.com) and log in
2. Go to package settings: Access → Publishing access
3. Add a new trusted publisher:
   - Repository owner: `hongymagic`
   - Repository name: `q`
   - Workflow filename: `release.yml`
   - Environment: _(leave empty)_

This allows GitHub Actions to publish without storing npm tokens as secrets.

---

## Tests

Use vitest (not Bun's test runner).

Test cases cover:

- Config path resolution (XDG, CWD)
- Config cascade merging
- TOML parsing + Zod validation
- CLI parsing edge cases
- Provider resolution and overrides
- `--copy` behaviour
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
bun run fix         # Fix all auto-fixable issues (lint + format)
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
- **Keep stdout pure** (answer text only)


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

---

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

### Completing Features from `todo/`

When a feature from `todo/` is fully implemented:

1. Rename the file to mark it complete: `mv todo/001-feature.md todo/001-feature.done.md`
2. Or delete it if no longer needed for reference

---

## Code Style Guidelines

### Australian English

Use Australian/British English spellings throughout documentation and user-facing strings:

| American (Don't Use) | Australian (Use) |
|---------------------|------------------|
| behavior | behaviour |
| color | colour |
| initialize | initialise |
| organize | organise |
| customize | customise |
| center | centre |
| favor | favour |
| license (noun) | licence |

**Exception**: Technical identifiers like `xterm-256color` remain unchanged.

### Comments

- **No verbose JSDoc**: Don't add JSDoc comments that merely restate the function name
- **No module headers**: Don't add file-level comments explaining what the module does
- **Self-documenting code**: Prefer clear naming over comments
- **Only comment the "why"**: Add comments only for non-obvious logic or business decisions

```typescript
// Bad - restates the obvious
/** Create an OpenAI provider instance */
export function createOpenAIProvider() { ... }

// Good - no comment needed, function name is clear
export function createOpenAIProvider() { ... }

// Good - explains non-obvious behaviour
// Retry with exponential backoff to handle rate limits
await retry(request, { maxAttempts: 3, backoff: 'exponential' });
```

### General Style

- Keep code concise and readable
- Prefer early returns over nested conditionals
- Use TypeScript's type system; avoid `any`
- Function and variable names should be descriptive but not verbose
