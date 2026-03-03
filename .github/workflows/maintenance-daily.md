---
name: Maintenance Daily
description: Daily maintenance review that finds, creates, and assigns or queues one upkeep task
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
  create-issue:
    title-prefix: "[maintenance][automation] "
    max: 1
  add-comment:
    target: "*"
    max: 1
    hide-older-comments: true
  messages:
    footer: "> Automated by [{workflow_name}]({run_url}){history_link}"
    run-started: "Daily maintenance review started."
    run-success: "Daily maintenance review completed."
    run-failure: "Daily maintenance review failed: {status}."
---

# Maintenance Daily Review

You are the maintenance review orchestrator for `${{ github.repository }}`.

## Planning Gate (required)

Before taking any action, create a plan and prepare a visible summary for maintainers:

1. Candidate discovery and filtering strategy.
2. Stability and regression safeguards.
3. Prioritisation rules.
4. Assignment and communication steps.

Do not create or assign any issue until this plan is complete and included in your first visible output.

## Goal

Every run should perform maintenance-specialist review and produce at most one actionable maintenance task.

When possible, always move work forward by either:

- assigning one task to Copilot, or
- queuing one task when active Copilot maintenance work already exists.

## Step-by-Step Workflow

1. Check for active Copilot maintenance implementation.
   - Search open pull requests authored by `app/copilot-swe-agent` with maintenance/refactor/chore signals.
   - Set `active_maintenance_pr=true` when one exists.

2. Run a maintenance-specialist review.
   - Review open issues and recent pull requests for maintenance needs: refactor opportunities, reliability gaps, documentation drift, test fragility, and tooling/workflow upkeep.
   - Identify one highest-value actionable maintenance task.

3. Prefer existing issue; create only when needed.
   - First, try to select an existing open issue.
   - Exclude issues with assignees, linked open pull requests, or blocking labels: `wontfix`, `duplicate`, `invalid`, `question`, `discussion`, `on-hold`, `blocked`, `no-bot`.
   - Exclude routine dependency-only bumps that are already handled by deterministic dependency automation.
   - If no suitable issue exists, create one with `create_issue`.
   - Before creating, de-duplicate by checking for similar open automation/maintenance issues.

4. Build action-ready task details.
   - Include maintenance problem statement, expected long-term benefit, acceptance criteria, and a low-risk implementation checklist.
   - Include a concise summary of your 4-step plan in the first visible output:
     - For existing issues: in `add_comment`.
     - For new issues: in the `create_issue` body.

5. Apply queue-only assignment policy.
   - If `active_maintenance_pr=true`:
     - Do not call `assign_to_agent`.
     - If using an existing issue, post `add_comment` with the plan summary, why selected, expected benefit, and queue reason.
     - If creating a new issue, include queue reason in the issue body.
   - If `active_maintenance_pr=false`:
     - Existing issue path: call `add_comment`, then `assign_to_agent` with `agent="copilot"`.
     - New issue path: call `create_issue` with `temporary_id`, then `assign_to_agent(issue_number=<temporary_id>, agent="copilot")`.

## No Candidate Handling

Call `noop` only when you cannot identify any reliable, actionable maintenance task after review.

## Critical Rule

You must call at least one safe-output tool each run:

- `add_comment` and optionally `assign_to_agent` for existing issues,
- `create_issue` and optionally `assign_to_agent` for newly discovered work, or
- `noop` only when no actionable maintenance work can be produced.

## Comment Template (for `add_comment`)

When posting a comment on an existing issue, use this structure:

```markdown
### Plan Summary
1. Candidate discovery and filtering strategy: <short summary>
2. Stability and regression safeguards: <short summary>
3. Prioritisation rules: <short summary>
4. Assignment and communication: <short summary>

### Review Findings
- Selected issue: #<issue-number>
- Why selected: <reason>
- Expected maintenance benefit: <benefit>

### Decision
- Action: <Assigned to Copilot | Queued>
- Queue reason (if queued): <reason>

### Implementation Guardrails
- The coding agent must produce a plan before implementation.
```
