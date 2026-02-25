# Feature: Follow-up Mode (Conversation Context)

## Overview

Enable multi-turn conversations with `--follow` or `-f` flag, persisting context between queries.

## Use Cases

```bash
# Start a new conversation
q "explain git rebase"

# Follow-up on the previous response
q -f "what about interactive mode?"

# Another follow-up
q -f "show me an example"

# Clear conversation and start fresh
q --clear
q "new topic"
```

## Design Decisions

### Session Storage

- Location: `~/.local/state/q/sessions/` (XDG state directory)
- Format: JSON file with conversation history
- Single session: `current.json` (no multi-session complexity for MVP)

### Session Schema

```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO 8601
}

interface Session {
  version: 1;
  provider: string;
  model: string;
  created: string; // ISO 8601
  updated: string; // ISO 8601
  messages: Message[];
}
```

### Context Strategy

- Send last N messages (configurable, default: 10) to avoid token limits
- Truncate old messages if total exceeds threshold
- Clear session if provider/model changes

### Session Expiry

- Sessions expire after 24 hours of inactivity
- Auto-clear on provider/model mismatch

## Implementation

### New Files

#### `src/session.ts`

```typescript
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.string(),
});

const SessionSchema = z.object({
  version: z.literal(1),
  provider: z.string(),
  model: z.string(),
  created: z.string(),
  updated: z.string(),
  messages: z.array(MessageSchema),
});

type Session = z.infer<typeof SessionSchema>;
type Message = z.infer<typeof MessageSchema>;

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_MESSAGES = 10;

export function getSessionDir(): string {
  const xdgState = process.env.XDG_STATE_HOME;
  if (xdgState) return join(xdgState, "q", "sessions");
  return join(process.env.HOME ?? "", ".local", "state", "q", "sessions");
}

export function getSessionPath(): string {
  return join(getSessionDir(), "current.json");
}

export async function loadSession(
  provider: string,
  model: string
): Promise<Session | null> {
  const path = getSessionPath();

  try {
    const content = await readFile(path, "utf-8");
    const data = JSON.parse(content);
    const result = SessionSchema.safeParse(data);

    if (!result.success) return null;

    const session = result.data;

    // Check expiry
    const updated = new Date(session.updated).getTime();
    if (Date.now() - updated > SESSION_TTL_MS) {
      await clearSession();
      return null;
    }

    // Check provider/model match
    if (session.provider !== provider || session.model !== model) {
      await clearSession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  const dir = getSessionDir();
  await mkdir(dir, { recursive: true });
  await writeFile(getSessionPath(), JSON.stringify(session, null, 2));
}

export async function clearSession(): Promise<void> {
  try {
    await unlink(getSessionPath());
  } catch {
    // Ignore if doesn't exist
  }
}

export function createSession(provider: string, model: string): Session {
  const now = new Date().toISOString();
  return {
    version: 1,
    provider,
    model,
    created: now,
    updated: now,
    messages: [],
  };
}

export function addMessages(
  session: Session,
  userMessage: string,
  assistantMessage: string
): Session {
  const now = new Date().toISOString();
  const messages = [
    ...session.messages,
    { role: "user" as const, content: userMessage, timestamp: now },
    { role: "assistant" as const, content: assistantMessage, timestamp: now },
  ].slice(-MAX_MESSAGES); // Keep last N messages

  return {
    ...session,
    updated: now,
    messages,
  };
}

export function buildConversationPrompt(
  session: Session,
  query: string
): string {
  if (session.messages.length === 0) return query;

  const history = session.messages
    .map((m) => `${m.role === "user" ? "Human" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  return `Previous conversation:\n${history}\n\nHuman: ${query}`;
}
```

### Files to Modify

#### `src/args.ts`

```typescript
// Add new options to parseArgs
options: {
  // ... existing options
  follow: { type: "boolean", short: "f", default: false },
  clear: { type: "boolean", default: false },
}

// Update ParsedArgs interface
interface ParsedArgs {
  // ... existing fields
  options: {
    // ... existing options
    follow: boolean;
    clear: boolean;
  };
}

// Update HELP_TEXT
OPTIONS:
  -f, --follow               Continue previous conversation
  --clear                    Clear conversation history
```

#### `src/cli.ts`

```typescript
import {
  loadSession,
  saveSession,
  clearSession,
  createSession,
  addMessages,
  buildConversationPrompt,
} from "./session.ts";

// Handle --clear command
if (args.options.clear) {
  await clearSession();
  console.log("Conversation cleared");
  process.exit(0);
}

// After resolving provider, load or create session
let session: Session | null = null;
if (args.options.follow) {
  session = await loadSession(providerName, modelId);
  if (!session) {
    logDebug("No previous session found, starting fresh", debug);
  }
}

// Build prompt with history if following
const prompt = session ? buildConversationPrompt(session, query) : query;

// Run query with the prompt
const result = await runQuery({
  model,
  query: prompt,
  systemPrompt: buildSystemPrompt(envInfo),
});

// Save session after successful query
if (args.options.follow) {
  session = session ?? createSession(providerName, modelId);
  session = addMessages(session, query, result.text);
  await saveSession(session);
}
```

## Testing

#### `tests/session.test.ts`

```typescript
describe("Session management", () => {
  it("should create new session");
  it("should load existing session");
  it("should expire old sessions");
  it("should clear on provider change");
  it("should clear on model change");
  it("should limit message history to MAX_MESSAGES");
  it("should build conversation prompt correctly");
  it("should handle missing session file");
  it("should handle corrupted session file");
});
```

## Acceptance Criteria

- [ ] `q -f "follow-up"` continues conversation
- [ ] `q --clear` clears session
- [ ] Session expires after 24h of inactivity
- [ ] Provider/model change clears session
- [ ] Message history limited to 10 turns
- [ ] Session stored in XDG state directory
- [ ] Tests pass
- [ ] AGENTS.md updated with follow-up examples

## Effort Estimate

- Implementation: 3-4 hours
- Testing: 2 hours
- Documentation: 30 minutes
