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

`q` works without a config file.

1. **Free local setup with Ollama**

```bash
ollama pull gemma3
q --provider ollama --model gemma3 explain this stack trace
```

2. **Free cloud setup with Gemini**

```bash
export GEMINI_API_KEY="your-key-here"
q explain rust lifetimes
```

3. **Optional: create a pinned config**

```bash
q config init
```

`q` auto-detects common provider keys (`GEMINI_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) and falls back to local Ollama when available.

## Usage

```bash
q how do I restart docker
GEMINI_API_KEY="your-key" q explain closures in javascript
q --copy what is a kubernetes pod
q --provider ollama --model gemma3 explain this error
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
| `--mode <mode>` | Output mode: `command` (default) or `explain` |
| `--copy` | Copy answer to clipboard |
| `--no-copy` | Disable copy (overrides config) |
| `--debug` | Enable debug logging to stderr |
| `-h, --help` | Show help message |
| `-v, --version` | Show version |

### Output Modes

By default, `q` returns terse, copy/paste-ready commands. Use `--mode explain` for detailed explanations:

```bash
q how do I restart docker               # Returns the command(s)
q --mode explain how do I restart docker # Returns a detailed explanation
```

### Commands

```bash
q config path    # Print config file path
q config init    # Create optional config file
q config doctor  # Diagnose config and setup issues
q providers      # List available providers + model and credential status
```

## Configuration

Config is optional. `q` starts with built-in provider presets and per-provider defaults, then applies overrides (later overrides earlier):

1. Built-in defaults (`google`, `groq`, `anthropic`, `openai`, `ollama`, `azure`, `bedrock`)
2. `$XDG_CONFIG_HOME/q/config.toml` (or `~/.config/q/config.toml`)
3. `./config.toml` (project-specific)
4. Environment: `Q_PROVIDER`, `Q_MODEL`, `Q_COPY`
5. CLI flags: `--provider`, `--model`

Each provider can specify its own default `model`, which takes precedence over `default.model` but is overridden by `Q_MODEL` or `--model`:

```toml
[default]
provider = "google"
# model = "gemini-2.5-flash"         # Optional global default

[providers.google]
type = "google"
api_key_env = "GEMINI_API_KEY"
model = "gemini-2.5-flash"           # Optional per-provider default
```

See [config.example.toml](config.example.toml) for all options.

### Free Setup Options

| Option | Cost | What you need | Notes |
|------|------|---------------|-------|
| `ollama` | Free local | Ollama installed and a local model | Best zero-key/offline option |
| `google` | Free tier | `GEMINI_API_KEY` (or `GOOGLE_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`) | Best free cloud default |
| `groq` | Free tier | `GROQ_API_KEY` | Fast free cloud fallback |

### Provider Types

| Type | Built in | Description |
|------|----------|-------------|
| `google` | Yes | Google Gemini API |
| `groq` | Yes | Groq (ultra-fast open models) |
| `ollama` | Yes | Local Ollama instance |
| `anthropic` | Yes | Anthropic Claude API |
| `openai` | Yes | OpenAI API |
| `azure` | Yes | Azure OpenAI deployments |
| `bedrock` | Yes | AWS Bedrock (Claude, Titan, Llama) |
| `openai_compatible` | No | Any OpenAI-compatible API (needs `base_url`) |
| `portkey` | No | Portkey AI Gateway (needs `base_url` and `provider_slug`) |

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

**"Setup required" error:**

Use one of these quick starts:

```bash
export GEMINI_API_KEY="your-key-here"
q explain kubernetes pods
```

```bash
q --provider ollama --model gemma3 explain kubernetes pods
```

Or create a config file with `q config init`.

**"Missing API key" error:**

Ensure your API key environment variable is set:

```bash
export GEMINI_API_KEY="your-key-here"
```

**Diagnose config issues:**

Run `q config doctor` to check config files, environment overrides, built-in defaults, and provider health at a glance.

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
