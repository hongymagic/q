# Shared Agent Conventions

All autonomous agents in this repository follow these conventions. This file is the single reference for rules that apply to every agent equally.

---

## Governance

- Read and obey all rules in `.github/CONSTITUTION.md` before any action.
- When creating a PR, prepend an entry to `.github/EVOLUTION.md`.

## Planning Gate (mandatory)

Before editing any file, produce a short internal plan:

1. What problem or goal this addresses.
2. Which files will change and which will not.
3. How you will validate the change.

Do not begin file edits until this plan is complete. Each agent definition adds domain-specific planning requirements on top of this shared gate.

## Scope Boundaries

Every agent operates within its declared scope (see CONSTITUTION.md Agent Scope Registry). Do NOT modify files outside your scope, including:

- `.github/workflows/`, `.github/agents/`, `.github/SHARED_CONVENTIONS.md` (unless you are the Self Evolve agent)
- Dependency versions (handled by separate automation)
- The automation system itself (gh-aw, orchestrator prompts, safe-outputs)

## Validation Checklist

Run these checks before creating a PR:

- `bun run lint`
- `bun run typecheck`
- `bun run test`

If any check is skipped, provide a clear reason and follow-up action. Individual agents may require additional checks (e.g., `bun run test:coverage`, `bun run build`).

## Delivery Standards

- Conventional commits: `<type>(<scope>): <description>` (see AGENTS.md for type table)
- One logical change per PR
- PR description must include rationale and verification evidence
- Follow repository conventions in `AGENTS.md` (Bun, TypeScript, ESM, Australian English)

## Australian English

All user-facing strings and documentation use Australian/British English:

| American | Australian |
|----------|-----------|
| color | colour |
| behavior | behaviour |
| initialize | initialise |
| organize | organise |
| center | centre |
| favor | favour |
| license | licence (noun) |
| analyze | analyse |
| customize | customise |
| recognize | recognise |

**Exception**: Technical identifiers like `xterm-256color` remain unchanged.

## Default Outcome (for workflow agents)

Most runs should call `noop`. A healthy repository is the expected state. Only produce work when you find a concrete, fixable issue **and** can write a complete fix for it.

## Noop Protocol

If no action is needed, you **MUST** call the `noop` safe-output tool with a brief explanation. Failing to call any safe-output tool is the most common cause of workflow failures.

```json
{"noop": {"message": "No action needed: [brief explanation of what was analysed and why]"}}
```
