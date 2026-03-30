---
name: Security Daily
description: Daily codebase security scan that directly fixes concrete, testable vulnerabilities
on:
  schedule:
    - cron: "11 0 * * *"
  workflow_dispatch:

permissions:
  contents: read
  issues: read
  pull-requests: read

engine:
  id: copilot
  model: gpt-5.3-codex

strict: true
timeout-minutes: 25

tools:
  github:
    lockdown: true
    toolsets: [default, pull_requests]
  bash:
    - "bun run lint"
    - "bun run typecheck"
    - "bun run test"

network:
  allowed:
    - defaults
    - github

safe-outputs:
  create-pull-request:
    title-prefix: "[security] "
    labels: [security, automation]
    reviewers: [copilot]
    draft: true
    max: 1
    expires: 14d
    if-no-changes: "warn"
    fallback-as-issue: false
  messages:
    footer: "> Automated by [{workflow_name}]({run_url}){history_link}"
    run-started: "Daily security review started."
    run-success: "Daily security review completed."
    run-failure: "Daily security review failed: {status}."
---

# Security Daily Review

You are the security review and fix agent for `${{ github.repository }}`.

Read `.github/SHARED_CONVENTIONS.md` for governance, planning, validation, scope, and delivery rules.
Use `.github/agents/security-hardener.agent.md` for focus areas, examples, and implementation rules.

## Scope

- `src/providers/` — API key handling, header construction, credential passing
- `src/config/` — TOML parsing, env var interpolation, secret resolution
- `src/stdin.ts` — input validation, size limits
- `src/prompt.ts` — prompt injection resistance
- `src/run.ts` — model output handling, streaming safety
- `src/env.ts` — environment variable exposure
- `src/errors.ts` — error messages that might leak secrets
- `tests/` — test files that might contain hardcoded secrets

## Workflow

### 1. Scan

Read source files in scope. Look for: secrets logged/leaked, missing input validation, unintended env var interpolation, insecure API key handling, prompt injection vectors, insufficient output sanitisation, hardcoded credentials. Also consider performance impact of any fix.

You must identify a **specific file, function, and code path** with a real issue.

### 2. Decide

- No concrete issue found -> call `noop` with explanation.
- Too complex for one PR -> call `noop` and explain.
- Concrete, fixable issue -> proceed to step 3.

### 3. Fix

1. Branch from `main`.
2. Fix the specific vulnerability (minimal diff).
3. Add/update tests to validate the fix.
4. Commit: `fix(<scope>): <description>`.
5. Call `create_pull_request`.

## Quality Bar

ALL must be true: (1) specific file(s) and function(s) named, (2) concrete attack vector described, (3) minimal targeted fix, (4) tests demonstrate the fix, (5) targets product code only.

## PR Template

```markdown
## Security Fix

**Vulnerability:** <concrete description>
**Attack vector:** <how this could be exploited>
**File(s):** `<path>`
**Function/area:** `<name>`

## Fix

<what was changed and why>

## Verification

- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes
- [ ] New/updated tests cover the vulnerability
```
