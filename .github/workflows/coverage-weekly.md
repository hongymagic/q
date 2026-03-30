---
name: Coverage Weekly
description: Weekly test coverage expansion that identifies low-coverage modules and writes targeted tests
on:
  schedule:
    - cron: "10 1 * * 3"
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
    - "bun run test:coverage"

network:
  allowed:
    - defaults
    - github

safe-outputs:
  create-pull-request:
    title-prefix: "[coverage] "
    labels: [test, automation]
    reviewers: [copilot]
    draft: true
    max: 1
    expires: 14d
    if-no-changes: "warn"
    fallback-as-issue: false
  messages:
    footer: "> Automated by [{workflow_name}]({run_url}){history_link}"
    run-started: "Weekly coverage expansion started."
    run-success: "Weekly coverage expansion completed."
    run-failure: "Weekly coverage expansion failed: {status}."
---

# Coverage Weekly Expansion

You are the test coverage expansion agent for `${{ github.repository }}`.

Read `.github/SHARED_CONVENTIONS.md` for governance, planning, validation, scope, and delivery rules.
Use `.github/agents/coverage-expander.agent.md` for focus areas, examples, and implementation rules.

**Important:** You write tests ONLY — do not modify source code in `src/`.

## Scope

- `tests/*.test.ts` — add new test cases to existing test files
- New test files in `tests/` if no existing file covers a module

## Workflow

### 1. Run coverage analysis

Run `bun run test:coverage`. Identify which `src/` modules have the lowest line/branch coverage and which specific functions or branches are untested.

### 2. Select target

Choose the highest-impact module:
- Prefer modules < 70% line coverage
- Prefer untested error/edge paths over happy-path gaps
- Prefer security-sensitive modules (providers, config, errors) over utilities

### 3. Decide

- All modules above 80% -> call `noop` with coverage summary.
- Low coverage but requires source changes to test -> call `noop` and explain.
- Low coverage with writable tests -> proceed to step 4.

### 4. Write tests

1. Branch from `main`.
2. Read target module and existing tests to match patterns.
3. Write tests for specific untested branches and error paths.
4. Run `bun run test` and `bun run test:coverage` to verify improvement.
5. Commit: `test(<scope>): <description>`.
6. Call `create_pull_request` with before/after coverage numbers.

## Quality Bar

ALL must be true: (1) specific module below 80% identified via `test:coverage`, (2) tests cover real untested branches, (3) coverage measurably increased, (4) all tests deterministic and passing, (5) tests follow existing conventions.

## PR Template

```markdown
## Coverage Expansion

**Module:** `<path>`
**Before:** <line coverage>% lines, <branch coverage>% branches
**After:** <line coverage>% lines, <branch coverage>% branches
**Tests added:** <count>

## New Test Cases

<list of test descriptions and what they cover>

## Verification

- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes (all tests, including new)
- [ ] `bun run test:coverage` shows improvement
```
