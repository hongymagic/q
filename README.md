# q — Quick AI Answers from the Command Line

A fast, minimal CLI for getting AI answers directly in your terminal.

## Installation

Download the latest binary for your platform from the [releases page](../../releases).

Or build from source with [Bun](https://bun.sh):

```bash
git clone <repo-url> && cd q
bun install && bun run build
```

## Setup

1. **Create config:**

```bash
q config init
# or copy config.example.toml to ~/.config/q/config.toml
```

2. **Set your API key:**

```bash
export ANTHROPIC_API_KEY="your-key-here"
```

## Usage

```bash
q how do I restart docker
q --stream explain git rebase
q --copy what is a kubernetes pod
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --provider <name>` | Override the default provider |
| `-m, --model <id>` | Override the default model |
| `--stream` | Stream response as it arrives |
| `--copy` | Copy answer to clipboard |
| `--json` | Output structured JSON |
| `-h, --help` | Show help message |

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
3. Environment: `Q_PROVIDER`, `Q_MODEL`

See [config.example.toml](config.example.toml) for all options.

### Provider Types

| Type | Description |
|------|-------------|
| `anthropic` | Anthropic Claude API |
| `openai` | OpenAI API |
| `openai_compatible` | Any OpenAI-compatible API |
| `ollama` | Local Ollama instance |

## License

MIT
