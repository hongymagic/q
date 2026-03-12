---
name: usability-fix
description: Plan-first workflow for improving CLI usability in q
---

# Usability Fix Skill

Use this skill when improving user experience: help text, error messages, interactive prompts, and documentation in `q`.

## Mandatory Planning Sequence

Before edits:

1. Identify the specific UX issue with a concrete example (what the user sees).
2. Explain why it is confusing, inconsistent, or unhelpful.
3. Propose the improved experience (what the user should see).
4. Verify the fix does not break existing behaviour.

Start implementation only after this plan is complete.

## Good vs Bad Work — Examples

### Good usability work (concrete, user-visible, measurable improvement)

- Improving an error message from "ENOENT" to "Config file not found at ~/.config/q/config.toml. Run 'q config init' to create one."
- Fixing American English "color" → "colour" in user-facing strings
- Adding recovery guidance to the provider connection failure message: "Check your API key and network connection"
- Making `--help` output consistent: all options have descriptions, same indentation
- Improving the loading indicator message from "Loading..." to "Querying anthropic/claude-sonnet-4..."

### Bad usability work (cosmetic-only, subjective, out of scope)

- "Redesign the CLI output format" — too broad, no specific improvement
- "Add emoji to all messages" — against project conventions (no emojis)
- "Change the CLI name from q to something more descriptive" — breaking change
- "Add interactive mode with arrow-key navigation" — too large for a single fix
- "Reword all error messages" — must be targeted, not wholesale

## Australian English Checklist

Verify all user-facing strings use Australian/British English:

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

## Implementation Checklist

1. Change only user-facing strings (stdout, stderr, help text, docs).
2. Preserve existing CLI flags and command syntax.
3. Error messages should include: what happened, why, and what to do next.
4. Keep output concise — terminal users expect brevity.
5. Test changes by running the CLI.
6. Update `README.md` if help text or commands change.

## Verification Checklist

Run:

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `echo "" | bun run src/cli.ts --help` (verify help output)

## Output Requirements

Report:

1. Before/after comparison of changed strings.
2. Which user paths are improved.
3. Australian English compliance confirmed.
