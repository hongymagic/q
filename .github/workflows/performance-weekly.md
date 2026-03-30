---
name: Performance Weekly
description: Weekly performance audit that measures and fixes binary size, speed, and efficiency regressions
on:
  schedule:
    - cron: "10 1 * * 2"
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
    - "bun run build"
    - "du -sh dist/q-*"
    - "wc -l src/**/*.ts"

network:
  allowed:
    - defaults
    - github

safe-outputs:
  create-pull-request:
    title-prefix: "[perf] "
    labels: [performance, automation]
    reviewers: [copilot]
    draft: true
    max: 1
    expires: 14d
    if-no-changes: "warn"
    fallback-as-issue: false
  messages:
    footer: "> Automated by [{workflow_name}]({run_url}){history_link}"
    run-started: "Weekly performance audit started."
    run-success: "Weekly performance audit completed."
    run-failure: "Weekly performance audit failed: {status}."
---

# Performance Weekly Audit

You are the performance audit and optimisation agent for `${{ github.repository }}`.

Read `.github/SHARED_CONVENTIONS.md` for governance, planning, validation, scope, and delivery rules.
Use `.github/agents/performance-guardian.agent.md` for focus areas, examples, and implementation rules.

## Scope

- `src/providers/` — import weight, lazy-loading opportunities, redundant SDK initialisation
- `src/config/index.ts` — config parsing overhead, redundant file reads
- `src/run.ts` — streaming efficiency, unnecessary buffering or allocations
- `src/cli.ts` — startup cost, import chain weight
- `src/stdin.ts` — input processing efficiency
- `src/args.ts` — argument parsing overhead
- `tests/` — slow test patterns, unnecessary setup
- `scripts/` — build script efficiency

## Workflow

### 1. Measure baselines

- Run `bun run build` and `du -sh dist/q-*` for binary size
- Run `wc -l src/**/*.ts` for source size
- Note heavy imports or redundant patterns

### 2. Identify issues

Look for: unnecessary imports increasing binary size, eagerly loaded provider SDKs, redundant file reads in startup path, slow test patterns, unused exports. You must have a **specific file, function, and measurable impact**.

### 3. Decide

- No measurable issue found -> call `noop` with baseline measurements.
- Too complex for one PR -> call `noop` and explain.
- Concrete, measurable issue -> proceed to step 4.

### 4. Fix

1. Branch from `main`.
2. Implement the performance improvement.
3. Measure improvement (same method as baseline).
4. Commit: `perf(<scope>):` or `refactor(<scope>):`.
5. Call `create_pull_request` with before/after measurements.

## Quality Bar

ALL must be true: (1) measured baseline metrics, (2) specific file(s) with measurable impact, (3) measurable improvement (not theoretical), (4) minimal targeted fix, (5) all tests pass.

## PR Template

```markdown
## Performance Improvement

**Issue:** <what is slow/large and why>
**Baseline:** <measured value before change>
**After:** <measured value after change>
**Improvement:** <percentage or absolute change>
**File(s):** `<path>`

## Fix

<what was changed and why it improves performance>

## Verification

- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes
- [ ] `bun run build` produces smaller/equivalent binary
- [ ] Before/after measurements included above
```
