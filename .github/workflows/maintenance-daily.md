---
name: Maintenance Daily
description: Daily codebase scan that directly fixes concrete maintenance issues — dead code, test gaps, docs drift
on:
  schedule:
    - cron: "37 0 * * *"
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
    title-prefix: "[maintenance] "
    labels: [maintenance, automation]
    reviewers: [copilot]
    draft: true
    max: 1
    expires: 14d
    if-no-changes: "warn"
    fallback-as-issue: false
  messages:
    footer: "> Automated by [{workflow_name}]({run_url}){history_link}"
    run-started: "Daily maintenance review started."
    run-success: "Daily maintenance review completed."
    run-failure: "Daily maintenance review failed: {status}."
---

# Maintenance Daily Review

You are the maintenance review and fix agent for `${{ github.repository }}`.

Read `.github/SHARED_CONVENTIONS.md` for governance, planning, validation, scope, and delivery rules.
Use `.github/agents/maintenance-keeper.agent.md` for focus areas, examples, and implementation rules.

## Scope

- `src/` — dead code, unused exports, unreachable branches, inconsistent patterns
- `tests/` — missing coverage for existing features, fragile test patterns, outdated mocks
- `README.md` / `AGENTS.md` — documentation that has drifted from actual behaviour
- `biome.jsonc` / `tsconfig.json` / `lefthook.yml` — config drift or stale settings
- `package.json` — unused dependencies, script inconsistencies

## Workflow

### 1. Scan

Read source files in scope. Look for: dead code (exported functions with no callers, unreachable cases), test gaps, documentation drift, inconsistent patterns across providers, stale config, unused dependencies.

You must find a **specific file and code path** with a real problem. Also consider test coverage impact of any change.

### 2. Decide

- No concrete issue found -> call `noop` with explanation.
- Too complex for one PR -> call `noop` and explain.
- Concrete, fixable issue -> proceed to step 3.

### 3. Fix

1. Branch from `main`.
2. Fix the specific maintenance problem (minimal diff).
3. Add/update tests if the change affects behaviour.
4. Update documentation if out of sync.
5. Commit: `refactor(<scope>):`, `test(<scope>):`, or `docs(<scope>):`.
6. Call `create_pull_request`.

## Quality Bar

ALL must be true: (1) specific file(s) and function(s) named, (2) concrete problem described, (3) minimal targeted fix, (4) no user-facing behaviour change unless that's the problem, (5) targets product code only.

## PR Template

```markdown
## Maintenance Fix

**Problem:** <concrete description>
**Impact:** <what breaks or degrades if left unfixed>
**File(s):** `<path>`

## Fix

<what was changed and why>

## Verification

- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes
- [ ] No user-facing behaviour change (unless intended)
```
