#!/bin/bash
# Jules environment setup for q CLI

set -e

# Install Bun (if not present)
if ! command -v bun &> /dev/null; then
  echo "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

echo "Bun version: $(bun --version)"

# Install dependencies
echo "Installing dependencies..."
bun install

# Verify setup
echo "Running type check..."
bun run typecheck

echo "Running linter..."
bun run lint

echo "Setup complete. Run 'bun run test' to verify."
