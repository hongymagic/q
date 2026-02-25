# Feature: Stdin/Pipe Support

## Overview

Enable `q` to read input from stdin, allowing piping and redirection workflows.

## Use Cases

```bash
# Pipe content with a question
cat error.log | q "what's wrong here?"
git diff | q "summarise these changes"

# Pipe query itself (no arguments)
echo "how do I restart docker" | q

# Heredoc for multiline context
q "explain this code" << 'EOF'
function fibonacci(n) {
  return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2);
}
EOF
```

## Design Decisions

### Input Modes

| Scenario                   | stdin   | args  | Behaviour                                  |
| -------------------------- | ------- | ----- | ------------------------------------------ |
| `q how do I...`            | empty   | query | Normal: args = query                       |
| `cat log \| q "explain"`   | content | query | Context mode: stdin = context, args = query |
| `echo "question" \| q`     | content | none  | Query mode: stdin = query                  |
| `q` (no input)             | empty   | none  | Show help (existing)                       |

### Detection

Use Bun's `Bun.stdin.stream()` with `process.stdin.isTTY` to detect piped input:

- `process.stdin.isTTY === true` → No piped input
- `process.stdin.isTTY === false/undefined` → Piped input available

## Implementation

### Files to Modify

#### `src/stdin.ts` (new)

```typescript
export interface StdinInput {
  content: string | null;
  hasInput: boolean;
}

export async function readStdin(): Promise<StdinInput> {
  // Return null if TTY (interactive terminal)
  if (process.stdin.isTTY) {
    return { content: null, hasInput: false };
  }

  // Read stdin
  const chunks: string[] = [];
  const decoder = new TextDecoder();

  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(decoder.decode(chunk));
  }

  const content = chunks.join("").trim();
  return {
    content: content || null,
    hasInput: content.length > 0,
  };
}
```

#### `src/cli.ts`

```typescript
import { readStdin } from "./stdin.ts";

// In main():
const stdinInput = await readStdin();

// Build query based on input mode
let query: string;
let context: string | null = null;

if (stdinInput.hasInput && args.query.length > 0) {
  // Context mode: stdin is context, args is question
  context = stdinInput.content;
  query = args.query.join(" ");
} else if (stdinInput.hasInput) {
  // Query mode: stdin is the question
  query = stdinInput.content!;
} else {
  // Normal mode: args is the question
  query = args.query.join(" ");
}

// Pass context to runQuery
await runQuery({
  model,
  query,
  context, // New field
  systemPrompt: buildSystemPrompt(envInfo),
});
```

#### `src/run.ts`

```typescript
export interface RunOptions {
  model: LanguageModel;
  query: string;
  context?: string | null; // New field
  systemPrompt: string;
}

export async function runQuery(options: RunOptions): Promise<RunResult> {
  const { model, query, context, systemPrompt } = options;

  // Build the prompt with context if provided
  const fullPrompt = context
    ? `Context:\n\`\`\`\n${context}\n\`\`\`\n\nQuestion: ${query}`
    : query;

  // ... rest of implementation uses fullPrompt instead of query
}
```

### Security Considerations

- Limit stdin size (same as query: 5000 chars, or configurable limit for context mode)
- Don't log full stdin content in debug mode (could contain sensitive data)
- Validate that stdin content doesn't exceed reasonable limits

## Testing

#### `tests/stdin.test.ts`

```typescript
describe("stdin reading", () => {
  it("should return null when stdin is TTY");
  it("should read piped content");
  it("should handle empty stdin");
  it("should respect size limits");
});
```

#### `tests/args.test.ts` (additions)

```typescript
describe("stdin integration", () => {
  it("should use stdin as query when no args provided");
  it("should use stdin as context when args provided");
});
```

## Acceptance Criteria

- [ ] `echo "question" | q` works (stdin as query)
- [ ] `cat file | q "explain"` works (stdin as context)
- [ ] Normal usage `q question` unchanged
- [ ] Size limits enforced
- [ ] Tests pass
- [ ] AGENTS.md updated with stdin examples

## Effort Estimate

- Implementation: 2-3 hours
- Testing: 1 hour
- Documentation: 30 minutes
