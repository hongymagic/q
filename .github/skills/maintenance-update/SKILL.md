---
name: maintenance-update
description: Plan-first maintenance workflow for reliable, low-risk repository updates
---

# Maintenance Update Skill

Use this skill for maintenance tasks in `q` (refactors, workflow upkeep, docs alignment, and technical debt reduction).

## Mandatory Planning Sequence

Before edits:

1. Define maintenance goal and non-goals.
2. Identify affected files and possible regressions.
3. Sequence changes into small, reversible steps.
4. Define checks to confirm behaviour is preserved.

Do not begin implementation until this plan is complete.

## Implementation Checklist

1. Preserve existing CLI contracts unless explicitly changing them.
2. Avoid mixing unrelated clean-ups into one change.
3. Keep docs and automation files in sync with code changes.
4. Prefer clear, maintainable code over clever shortcuts.
5. Keep security posture unchanged or improved.

## Verification Checklist

Run:

- `bun run lint`
- `bun run typecheck`
- `bun run test`

If partial validation is used, record scope and follow-up steps.

## Output Requirements

Report:

1. Plan summary and scope boundaries.
2. Maintenance benefits achieved.
3. Validation results.
