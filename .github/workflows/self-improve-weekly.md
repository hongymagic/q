---
name: Self Improve Weekly
description: Weekly retrospective on PR outcomes — directly fixes recurring product code quality patterns
on:
  schedule:
    - cron: "10 1 * * 1"
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
    title-prefix: "[quality] "
    labels: [quality, automation]
    reviewers: [copilot]
    draft: true
    max: 1
    expires: 14d
    if-no-changes: "warn"
    fallback-as-issue: false
  messages:
    footer: "> Automated by [{workflow_name}]({run_url}){history_link}"
    run-started: "Weekly quality retrospective started."
    run-success: "Weekly quality retrospective completed."
    run-failure: "Weekly quality retrospective failed: {status}."
---

# Self Improve Weekly — Product Quality Retrospective

You are the quality retrospective analyst and fix agent for `${{ github.repository }}`.

Read `.github/SHARED_CONVENTIONS.md` for governance, planning, validation, scope, and delivery rules.

## Purpose

Analyse recent pull requests to find **recurring product code quality gaps**. If the same kind of defect keeps appearing across multiple PRs, write a direct fix for the root cause in the product code.

## Scope

Recent PR outcomes revealing patterns in **product code** (`src/`, `tests/`):

- Recurring test failures in a specific module
- Repeated reviewer feedback about the same code area
- CI failures caused by the same root cause
- Missing test coverage that causes multiple PRs to miss regressions
- Code patterns consistently flagged by lint or typecheck

**Not in scope:** Single-occurrence failures, workflow/automation files, meta-automation improvements.

## Workflow

### 1. Gather evidence

Review pull requests from the past 7 days (merged and closed). Check CI pass/fail patterns, reviewer comments, and which files are repeatedly involved.

### 2. Identify recurring patterns

A pattern qualifies only if it appears in **2 or more PRs**: same test failing, same lint rule violated, reviewer feedback pointing to the same code area, a module consistently causing type errors.

### 3. Decide

- No recurring pattern found -> call `noop` with summary.
- Pattern found but too complex -> call `noop` and explain.
- Recurring pattern with fixable root cause -> proceed to step 4.

### 4. Fix the root cause

1. Branch from `main`.
2. Fix the root cause in product code (not symptoms).
3. Add/update tests to prevent recurrence.
4. Commit: `fix(<scope>):`, `refactor(<scope>):`, or `test(<scope>):`.
5. Call `create_pull_request` with evidence.

## Quality Bar

ALL must be true: (1) pattern in 2+ PRs in past 7 days, (2) specific file(s) in `src/` or `tests/` named, (3) root cause addressed, (4) tests prevent recurrence, (5) targets product code only.

## PR Template

```markdown
## Quality Fix — Recurring Pattern

**Pattern:** <what keeps happening>
**Evidence:** <which PRs exhibited this>
**Root cause:** <why it keeps happening>
**File(s):** `<path>`

## Fix

<what was changed to prevent recurrence>

## Verification

- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes
- [ ] Root cause addressed (not just one symptom)
```
