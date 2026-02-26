# Jules Configuration

This directory contains configuration for [Google Jules](https://jules.google), an asynchronous AI coding agent.

Jules also reads `AGENTS.md` in the repo root for project-specific guidance.

## Setup Script

`setup.sh` is run by Jules to prepare the development environment. It:

1. Installs Bun (if not present)
2. Installs project dependencies
3. Runs type checking and linting to verify setup

## Usage

1. Connect this repo to Jules at [jules.google.com](https://jules.google.com)
2. Jules will automatically use `setup.sh` for environment setup
3. Jules reads `AGENTS.md` for coding conventions and guidelines

## Manual Testing

To test the setup script locally:

```bash
./.jules/setup.sh
```
