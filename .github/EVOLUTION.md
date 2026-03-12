# Evolution Log

Tracks all autonomous changes made by agentic workflows in this repository. The Self Evolve Fortnightly agent uses this log to assess agent effectiveness and propose improvements.

## Format

Each entry records:

- **Date**: When the change was proposed (UTC)
- **Agent**: Which workflow created it
- **PR**: Pull request number
- **Outcome**: `merged` / `closed` / `expired` / `open`
- **Summary**: One-line description of the change

---

## Log

<!-- Newest entries at the top. Agentic workflows prepend entries when creating PRs. -->

| Date | Agent | PR | Outcome | Summary |
|------|-------|----|---------|---------|
| 2026-03-12 | Feature Daily | #67 | merged | feat(stdin): enforce stdin query length limit |
| 2026-03-11 | Security Daily | #66 | merged | fix: secret leakage in debug logs via unfiltered arrays |
| 2026-03-09 | Security Daily | #59 | merged | fix: secret leakage in debug logs via JSON.stringify |
| 2026-03-08 | Maintenance Daily | #57 | merged | docs(readme): align config path docs with XDG behaviour |
| 2026-03-06 | Security Daily | #50 | merged | fix(prompt): harden context closing-tag sanitisation |
| 2026-03-06 | Security Daily | #49 | merged | fix(security): fix secret leakage in Portkey provider debug logs |
