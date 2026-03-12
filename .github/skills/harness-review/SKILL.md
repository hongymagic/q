---
name: harness-review
description: Checklist for evaluating and evolving the agent harness — workflows, agents, and skills
---

# Harness Review Skill

Use this skill when analysing or modifying the agent automation infrastructure.

## Pre-Modification Checklist

Before making any changes:

1. Read all workflow `.md` files to understand current state
2. Read evolution memory (journal, patterns, rejected) for context
3. Calculate effectiveness metrics for each agent
4. Identify the specific, evidence-based improvement

## Safety Invariants (Mandatory)

Verify these BEFORE and AFTER any modification:

| Invariant | Check |
|-----------|-------|
| Immutable frontmatter | `safe-outputs`, `permissions`, `engine` blocks unchanged |
| Planning gates | All agents still have mandatory planning sequence |
| Noop default | All workflows default to noop |
| Scope boundaries | Product-code agents don't touch workflow files |
| Single PR limit | `max: 1` in all `safe-outputs.create-pull-request` |
| Expiry | `expires: 14d` in all `safe-outputs.create-pull-request` |
| Draft PRs | `draft: true` in all `safe-outputs.create-pull-request` |
| No deletions | No workflows, agents, or skills removed |

## Good vs Bad Harness Changes — Examples

### Good harness changes (evidence-based, minimal, safe)

- Strengthening the security-daily scanning checklist after it missed a vulnerability class that was later found manually
- Adding a "check ANSI sanitisation" item to the security skill after 3 PRs in the past month involved ANSI-related fixes
- Reducing feature-daily frequency from daily to weekly because it has had 28 consecutive noop runs
- Updating the self-improve-weekly examples section with a real pattern that it successfully identified

### Bad harness changes (risky, speculative, unsafe)

- "Improve all agent prompts for better quality" — no specific evidence or metric
- Removing the planning gate from an agent to "speed things up" — violates safety invariant
- Changing `permissions` to give agents write access — violates safety invariant
- Adding a new workflow without evidence that existing agents can't cover the need
- Deleting a workflow because its noop rate is high — noop is the healthy default

## Effectiveness Metrics

Calculate these for each agent over the past 30 days:

| Metric | Healthy Range | Action if Outside |
|--------|--------------|-------------------|
| PR merge rate | 50-100% | If < 50%, tighten quality bar or improve examples |
| Noop rate | 70-100% | If < 70%, agent may be too aggressive; tighten scope |
| Time to merge | 1-7 days | If > 7d, PRs may be too large or unclear |
| False positive rate | 0-20% | If > 20%, scanning criteria too loose |

## Output Requirements

After completing analysis:

1. Report effectiveness metrics for each agent
2. State which safety invariants were verified
3. Describe the improvement with evidence
4. Confirm all invariants are preserved post-change
