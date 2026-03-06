---
name: maintenance-update
description: Plan-first maintenance workflow for reliable, low-risk repository updates
---

# Maintenance Update Skill

Use this skill for maintenance tasks in `q` (refactors, test improvements, docs alignment, and technical debt reduction).

## Mandatory Planning Sequence

Before edits:

1. Define maintenance goal and non-goals.
2. Identify affected files and possible regressions.
3. Sequence changes into small, reversible steps.
4. Define checks to confirm behaviour is preserved.

Do not begin implementation until this plan is complete.

## Good vs Bad Work — Examples

### Good maintenance work (concrete, testable, product code)

- Removing an unused `formatOutput` export from `src/run.ts` that has no callers
- Adding test coverage for the `ollama` provider adapter in `tests/providers.test.ts`
- Updating AGENTS.md to reflect that `q config show` was added (docs drift)
- Fixing inconsistent error handling in `src/providers/azure.ts` to match the pattern used by other providers
- Removing `chalk` from `package.json` dependencies since it is not imported anywhere

### Bad maintenance work (vague, meta, out of scope)

- "Improve code quality across the repository" — no specific file or problem
- "Refactor workflow orchestration for better maintainability" — workflow files are out of scope
- "Bump TypeScript to latest version" — dependency bumps are handled separately
- "Add comprehensive logging throughout the codebase" — too broad, no specific need

## Implementation Checklist

1. Preserve existing CLI contracts unless explicitly changing them.
2. Avoid mixing unrelated clean-ups into one change.
3. Keep docs and config files in sync with code changes.
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
