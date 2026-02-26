# q — Quick AI Answers from the Command Line

[![CI](https://github.com/hongymagic/q/actions/workflows/ci.yml/badge.svg)](https://github.com/hongymagic/q/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@hongymagic/q.svg)](https://www.npmjs.com/package/@hongymagic/q)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A fast, minimal CLI for getting AI answers directly in your terminal.

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

1. `~/.config/q/config.toml`
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

## Troubleshooting

**"Missing API key" error:**

Ensure your API key environment variable is set:

```bash
export ANTHROPIC_API_KEY="your-key-here"
```

**"Config file not found" error:**

Run `q config init` to create a default configuration file.

**Debug mode:**

Use `--debug` to see detailed logs on stderr:

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
