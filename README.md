# q — Quick AI Answers from the Command Line

[![CI](https://github.com/hongymagic/q/actions/workflows/ci.yml/badge.svg)](https://github.com/hongymagic/q/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@hongymagic/q.svg)](https://www.npmjs.com/package/@hongymagic/q)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A fast, minimal CLI for getting AI answers directly in your terminal.

When running in an interactive terminal, `q` shows a small ASCII loading indicator on stderr while it waits for the first response text.

## Installation

```bash
npm install -g @hongymagic/q
```

Or download a standalone binary from the [releases page](https://github.com/hongymagic/q/releases).

Or build from source with [Bun](https://bun.sh):

```bash
git clone https://github.com/hongymagic/q.git && cd q
bun install && bun run build
```

## Setup

1. **Create config:**

```bash
q config init
```

2. **Set your API key:**

```bash
export ANTHROPIC_API_KEY="your-key-here"
```

## Usage

```bash
q how do I restart docker
q --copy what is a kubernetes pod
```

### Piping Content

Pipe content as context for your question:

```bash
cat error.log | q "what's wrong here?"
git diff | q "summarise these changes"
```

Or pipe the query itself:

```bash
echo "how do I restart docker" | q
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --provider <name>` | Override the default provider |
| `-m, --model <id>` | Override the default model |
| `--copy` | Copy answer to clipboard |
| `--no-copy` | Disable copy (overrides config) |
| `--debug` | Enable debug logging to stderr |
| `-h, --help` | Show help message |
| `-v, --version` | Show version |

### Commands

```bash
q config path    # Print config file path
q config init    # Create example config
q providers      # List configured providers
```

## Configuration

Config is loaded from (later overrides earlier):

1. `$XDG_CONFIG_HOME/q/config.toml` (or `~/.config/q/config.toml`)
2. `./config.toml` (project-specific)
3. Environment: `Q_PROVIDER`, `Q_MODEL`, `Q_COPY`

See [config.example.toml](config.example.toml) for all options.

### Provider Types

| Type | Description |
|------|-------------|
| `anthropic` | Anthropic Claude API |
| `openai` | OpenAI API |
| `openai_compatible` | Any OpenAI-compatible API |
| `ollama` | Local Ollama instance |
| `portkey` | Portkey AI Gateway (self-hosted or cloud) |
| `google` | Google Gemini API |
| `groq` | Groq (ultra-fast Llama, Mixtral inference) |
| `azure` | Azure OpenAI deployments |
| `bedrock` | AWS Bedrock (Claude, Titan, Llama) |

### Portkey Gateway Setup

[Portkey](https://portkey.ai) is an AI gateway that provides unified access to multiple LLM providers with features like load balancing, caching, and observability. Use the `portkey` provider type for self-hosted or cloud deployments.

**Self-hosted gateway:**

```toml
[default]
provider = "portkey_internal"
model = "us.anthropic.claude-sonnet-4-20250514-v1:0"

[providers.portkey_internal]
type = "portkey"
base_url = "https://your-portkey-gateway.internal/v1"
provider_slug = "@your-org/bedrock-provider"
api_key_env = "PORTKEY_API_KEY"
provider_api_key_env = "PROVIDER_API_KEY"
```

**Configuration options:**

| Field | Description |
|-------|-------------|
| `base_url` | Your Portkey gateway URL |
| `provider_slug` | Provider identifier (maps to `x-portkey-provider` header) |
| `api_key_env` | Environment variable for Portkey API key (maps to `x-portkey-api-key` header) |
| `provider_api_key_env` | Environment variable for underlying provider's API key (maps to `Authorization` header) |
| `headers` | Additional custom headers (supports env var interpolation for allowlisted vars) |

**Environment variables:**

```bash
export PORTKEY_API_KEY="your-portkey-key"
export PROVIDER_API_KEY="your-provider-key"
```

## Self-Evolving System

`q` includes an autonomous improvement system powered by [GitHub Agentic Workflows](https://github.github.io/gh-aw/). AI agents continuously scan, assess, and improve the codebase across multiple dimensions — security, features, maintenance, performance, test coverage, and usability.

| Agent | Schedule | Purpose |
|-------|----------|---------|
| Security Daily | Daily | Scan and fix security vulnerabilities |
| Feature Daily | Daily | Detect and implement feature gaps |
| Maintenance Daily | Daily | Fix dead code, test gaps, docs drift |
| Self Improve Weekly | Monday | Retrospective on PR quality patterns |
| Performance Weekly | Tuesday | Binary size, speed, memory optimisation |
| Coverage Weekly | Wednesday | Expand test coverage |
| Usability Weekly | Thursday | CLI UX, error messages, help text |
| Self Evolve Fortnightly | 1st & 15th | Meta-agent: improve the agents themselves |

All agent PRs are created as drafts and require human approval to merge. The system is governed by `.github/CONSTITUTION.md` which defines immutable safety rules. All autonomous changes are tracked in `.github/EVOLUTION.md`.

## Troubleshooting

**"Missing API key" error:**

Ensure your API key environment variable is set:

```bash
export ANTHROPIC_API_KEY="your-key-here"
```

**"Config file not found" error:**

Run `q config init` to create a default configuration file.

**Failure logs:**

Most non-usage failures print a short error plus `Full log: <path>` on stderr. Logs are written to your platform log directory, for example `~/.local/state/q/errors` on Linux.

In an interactive terminal, query failures also offer quick recovery options: press `r` to retry, `Enter` to print the full log, or `q`/`Esc` to exit.

**Debug mode:**

Use `--debug` to keep detailed diagnostics on stderr while still writing the full failure log:

```bash
q --debug "how do I list docker containers"
```

**Piped content not working:**

Ensure you're piping content correctly. The query should be in arguments:

```bash
cat file.txt | q "explain this"   # Correct
cat file.txt | q                   # Uses stdin as query (no context)
```

## Licence

MIT
