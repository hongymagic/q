---
name: Feature Daily
description: Daily feature triage that assigns one high-impact enhancement issue to Copilot coding agent
on:
  schedule:
    - cron: "23 0 * * *"
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
    custom-agent: feature-implementer
    custom-instructions: |
      Mandatory plan-first execution.
      Load and apply the feature-delivery skill.
      Validate changes before finishing.
    github-token: ${{ secrets.GH_AW_AGENT_TOKEN }}
  add-comment:
    target: "*"
    max: 1
    hide-older-comments: true
  messages:
    footer: "> Automated by [{workflow_name}]({run_url}){history_link}"
    run-started: "Daily feature triage started."
    run-success: "Daily feature triage completed."
    run-failure: "Daily feature triage failed: {status}."
---

# Feature Daily Triage

You are the feature triage orchestrator for `${{ github.repository }}`.

## Planning Gate (required)

Before selecting any issue, create an internal plan with:

1. Candidate discovery approach.
2. Exclusion and deconfliction checks.
3. Prioritisation criteria.
4. Assignment and status communication flow.

Do not assign any issue until this plan is complete.

## Goal

Assign at most one high-impact feature/enhancement issue to Copilot coding agent each run.

## Step-by-Step Workflow

1. Check for active Copilot feature work.
   - Search open pull requests authored by `app/copilot-swe-agent` with feature/enhancement signals.
   - If active feature work exists, call `noop` and stop.

2. Build candidate list (priority order).
   - Query open issues labelled `enhancement`, `feature`, or `improvement`.
   - Also query open issues with title/body keywords: `feature`, `add`, `support`, `improve`, `enhancement`.

3. Apply exclusion filters.
   - Skip issues with assignees.
   - Skip issues with linked open pull requests.
   - Skip issues with blocking labels: `wontfix`, `duplicate`, `invalid`, `question`, `discussion`, `on-hold`, `blocked`, `no-bot`.
   - Skip issues that are clearly security-only or maintenance-only.

4. Rank remaining candidates.
   - Prefer clear user value and concrete acceptance criteria.
   - Prefer lower implementation uncertainty.
   - Pick exactly one issue.

5. Assign and notify.
   - Use `assign_to_agent` with `agent="copilot"` for the chosen issue.
   - Add an `add_comment` on the issue that includes:
     - why this issue was selected,
     - expected user value,
     - a reminder that implementation must begin with a plan.

## No Candidate Handling

If no suitable issue exists, call `noop` with a concise reason.

## Critical Rule

You must call at least one safe-output tool each run:

- `assign_to_agent` (+ optional `add_comment`) when assigning work, or
- `noop` when no action is required.
