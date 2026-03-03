---
name: feature-delivery
description: Plan-first feature delivery workflow for q enhancements
---

# Feature Delivery Skill

Use this skill when implementing new features or enhancements in `q`.

## Mandatory Planning Sequence

Before writing code:

1. Restate the requested outcome and acceptance criteria.
2. Map required code paths (CLI args, config, providers, runtime behaviour, tests).
3. Choose an incremental implementation order.
4. Define validation steps for each increment.

Start implementation only after this plan is complete.

## Implementation Checklist

1. Follow existing architecture and style (Bun + TypeScript + ESM).
2. Keep user-facing behaviour predictable and documented.
3. Add or update tests alongside behaviour changes.
4. Prefer additive changes over breaking changes unless requested.
5. Update README or AGENTS docs when user-facing workflows/options change.

## Verification Checklist

Run:

- `bun run lint`
- `bun run typecheck`
- `bun run test`

If full validation cannot run, document what was run and why.

## Output Requirements

Report:

1. Final implementation plan (short summary).
2. Behaviour changes delivered.
3. Validation evidence.
