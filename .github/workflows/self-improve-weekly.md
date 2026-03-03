---
name: Self Improve Weekly
description: Weekly review of agent outcomes to produce and assign the next workflow-system improvement
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

network:
  allowed:
    - defaults
    - github

safe-outputs:
  create-issue:
    title-prefix: "[automation] "
    max: 1
    close-older-issues: true
  assign-to-agent:
    target: "*"
    max: 1
    allowed: [copilot]
    model: gpt-5.3-codex
    custom-agent: maintenance-keeper
    custom-instructions: |
      Mandatory plan-first execution.
      Load and apply the maintenance-update skill.
      Focus only on workflow-system improvement.
    github-token: ${{ secrets.GH_AW_AGENT_TOKEN }}
  add-comment:
    target: "*"
    max: 1
    hide-older-comments: true
  messages:
    footer: "> Automated by [{workflow_name}]({run_url}){history_link}"
    run-started: "Weekly self-improvement review started."
    run-success: "Weekly self-improvement review completed."
    run-failure: "Weekly self-improvement review failed: {status}."
---

# Self Improve Weekly

You are the workflow improvement orchestrator for `${{ github.repository }}`.

## Planning Gate (required)

Before taking any action, produce an internal plan with:

1. Evidence collection from recent Copilot-authored pull requests and related issues.
2. Failure and friction pattern detection.
3. Improvement ranking by expected impact and effort.
4. Action path (assign existing issue, create new issue, or noop).

Do not create or assign work before this plan is complete.

## Goal

Each run should produce at most one actionable workflow-system improvement.

## Step-by-Step Workflow

1. Gather evidence.
   - Review recent pull requests authored by `app/copilot-swe-agent`.
   - Focus on repeated failure patterns: CI failures, abandoned drafts, repeated reviewer feedback, and missing test coverage.

2. Derive concrete improvements.
   - Identify 1-3 improvement candidates that would raise success rate or reduce cycle time.
   - Prefer improvements tied directly to security, feature, or maintenance workflows.

3. Check existing improvement backlog.
   - Search for open issues with automation/workflow-improvement intent (for example, titles containing `automation`, `workflow`, `orchestrator`, or `agent`).
   - If an existing issue already captures the top improvement and is not actively being worked on, select it.

4. Choose exactly one action.
   - If a suitable existing issue exists, call `assign_to_agent` with `agent="copilot"` and then `add_comment` with your evidence summary.
   - Otherwise, call `create_issue` with a clear problem statement, acceptance criteria, and a concise implementation checklist.
   - Do not assign a newly created issue in the same run.

## No Candidate Handling

If you cannot identify a reliable, actionable improvement, call `noop` with a concise explanation.

## Critical Rule

You must call at least one safe-output tool each run:

- `assign_to_agent`, `create_issue`, or `add_comment` for concrete actions, or
- `noop` when no action is required.
