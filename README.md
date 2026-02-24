# q — Quick AI Answers from the Command Line

A fast, minimal CLI for getting AI answers directly in your terminal. Built with Bun and the Vercel AI SDK.

## Features

- **Multiple providers**: OpenAI, Anthropic, OpenAI-compatible APIs (LM Studio, etc.), and Ollama
- **Streaming**: See responses as they arrive with `--stream`
- **Clipboard support**: Copy answers with `--copy`
- **JSON output**: Machine-readable output with `--json`
- **Flexible config**: TOML configuration with cascade merging
- **Single binary**: Compile to standalone executables for any platform

## Installation

Requires [Bun](https://bun.sh) runtime.

```bash
# Clone and install
git clone <repo-url> q
cd q
bun install

# Initialize config
bun run src/cli.ts config init
```

### Build Standalone Binary

```bash
# Build for current platform
bun run build

# Build for all platforms
bun run build:all

# Run the binary
./dist/q --help
```

## Quick Start

1. **Set up your API key:**

```bash
export ANTHROPIC_API_KEY="your-key-here"
# or
export OPENAI_API_KEY="your-key-here"
```

2. **Ask a question:**

```bash
q how do I restart docker
```

3. **Stream the response:**

```bash
q --stream explain git rebase
```

## Usage

```
q [options] <query...>       Ask a question
q config path                Print config file path
q config init                Create example config file
q providers                  List configured providers
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --provider <name>` | Override the default provider |
| `-m, --model <id>` | Override the default model |
| `--stream` | Stream response tokens as they arrive |
| `--copy` | Copy answer to clipboard |
| `--json` | Output structured JSON |
| `--debug` | Enable debug logging to stderr |
| `-h, --help` | Show help message |
| `-v, --version` | Show version |

### Examples

```bash
# Basic query
q how do I list docker containers

# Use a specific provider and model
q -p openai -m gpt-4o what is recursion

# Stream response and copy to clipboard
q --stream --copy explain kubernetes pods

# Get JSON output
q --json what is the capital of France
```

## Configuration

### Config Resolution Order

Config is loaded from multiple sources (later overrides earlier):

1. **XDG config**: `~/.config/q/config.toml` (or `$XDG_CONFIG_HOME/q/config.toml`)
2. **Project config**: `./config.toml` in current directory
3. **Environment variables**: `Q_PROVIDER`, `Q_MODEL`

### Environment Variables

| Variable | Description |
|----------|-------------|
| `Q_PROVIDER` | Override the default provider |
| `Q_MODEL` | Override the default model |

### Example Config

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

# OpenAI-compatible provider (e.g., LM Studio)
[providers.local]
type = "openai_compatible"
base_url = "http://localhost:1234/v1"
api_key_env = "LOCAL_API_KEY"

# Portkey (uses OpenAI provider with custom baseURL)
# Supports env var interpolation in base_url and headers
[providers.portkey]
type = "openai"
base_url = "https://api.portkey.ai/v1"
api_key_env = "PORTKEY_API_KEY"
headers = { "x-portkey-config" = "${PORTKEY_CONFIG_ID}" }

# Ollama (local models)
[providers.ollama]
type = "ollama"
base_url = "http://localhost:11434"
```

### Env Var Interpolation

You can use `${VAR_NAME}` syntax in `base_url` and `headers` values:

```toml
[providers.custom]
type = "openai"
base_url = "${CUSTOM_API_URL}"
headers = { "x-api-version" = "${API_VERSION}" }
```

### Provider Types

| Type | Description |
|------|-------------|
| `openai` | OpenAI API (also works with Portkey via `base_url`) |
| `anthropic` | Anthropic Claude API |
| `openai_compatible` | Any OpenAI-compatible API (LM Studio, etc.) |
| `ollama` | Local Ollama instance |

## Development

```bash
# Run tests
bun run test

# Type checking
bun run typecheck

# Lint (check for issues)
bun run lint

# Fix all auto-fixable issues (lint + format)
bun run fix

# Run directly
bun run src/cli.ts <query>

# Build for current platform
bun run build

# Build for all platforms
bun run build:all
```

### Pre-commit Hooks

This project uses [Lefthook](https://github.com/evilmartians/lefthook) to run [Biome](https://biomejs.dev/) checks before each commit.

After cloning, install the hooks:

```bash
bunx lefthook install
```

### Build Targets

| Script | Target |
|--------|--------|
| `build:darwin-arm64` | macOS Apple Silicon |
| `build:darwin-x64` | macOS Intel |
| `build:linux-x64` | Linux x64 |
| `build:linux-arm64` | Linux ARM64 |
| `build:windows-x64` | Windows x64 |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Runtime/provider error |
| 2 | Usage/config error |

## I/O Contract

- **stdout**: Answer text only (or JSON with `--json`)
- **stderr**: Logs, warnings, errors, debug info

## License

MIT
