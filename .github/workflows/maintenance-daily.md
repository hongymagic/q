---
name: Maintenance Daily
description: Daily maintenance triage that assigns one upkeep issue to Copilot coding agent
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

network:
  allowed:
    - defaults
    - github

safe-outputs:
  assign-to-agent:
    target: "*"
    max: 1
    allowed: [copilot]
    model: gpt-5.3-codex
    custom-agent: maintenance-keeper
    custom-instructions: |
      Mandatory plan-first execution.
      Load and apply the maintenance-update skill.
      Keep behaviour stable unless issue scope requires change.
    github-token: ${{ secrets.GH_AW_AGENT_TOKEN }}
  add-comment:
    target: "*"
    max: 1
    hide-older-comments: true
  messages:
    footer: "> Automated by [{workflow_name}]({run_url}){history_link}"
    run-started: "Daily maintenance triage started."
    run-success: "Daily maintenance triage completed."
    run-failure: "Daily maintenance triage failed: {status}."
---

# Maintenance Daily Triage

You are the maintenance triage orchestrator for `${{ github.repository }}`.

## Planning Gate (required)

Before selecting any issue, create an internal plan with:

1. Candidate discovery and filtering strategy.
2. Stability and regression safeguards.
3. Prioritisation rules.
4. Assignment and communication steps.

Do not assign any issue until this plan is complete.

## Goal

Assign at most one maintenance issue per run to keep repository health improving steadily.

## Step-by-Step Workflow

1. Check for active Copilot maintenance work.
   - Search open pull requests authored by `app/copilot-swe-agent` with maintenance/refactor/chore signals.
   - If active work exists, call `noop` and stop.

2. Build candidate list (priority order).
   - Query open issues labelled `maintenance`, `chore`, `refactor`, `tech-debt`, `documentation`, or `test`.
   - Also query open issues with title/body keywords: `refactor`, `cleanup`, `maintain`, `tech debt`, `test reliability`, `docs`.

3. Apply exclusion filters.
   - Skip issues with assignees.
   - Skip issues with linked open pull requests.
   - Skip issues with blocking labels: `wontfix`, `duplicate`, `invalid`, `question`, `discussion`, `on-hold`, `blocked`, `no-bot`.
   - Skip issues clearly covered by deterministic dependency automation when possible (for example, routine dependency bump-only tasks).

4. Rank remaining candidates.
   - Prefer issues that reduce long-term maintenance cost.
   - Prefer issues with low behavioural risk and clear acceptance criteria.
   - Select one issue only.

5. Assign and notify.
   - Use `assign_to_agent` with `agent="copilot"` for the chosen issue.
   - Add an `add_comment` including:
     - why this issue was selected,
     - expected maintenance benefit,
     - a reminder to plan before implementation.

## No Candidate Handling

If no suitable issue exists, call `noop` with a concise reason.

## Critical Rule

You must call at least one safe-output tool each run:

- `assign_to_agent` (+ optional `add_comment`) when assigning work, or
- `noop` when no action is required.
