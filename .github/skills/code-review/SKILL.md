---
name: code-review
description: Multi-dimensional code review rubric for evaluating PRs across correctness, security, performance, maintainability, and usability
---

# Code Review Skill

Use this skill when reviewing any pull request in `q`.

## Pre-Review Checklist

Before scoring, gather this context:

1. Read the full PR diff and understand the intent from the description
2. Read `.jules/sentinel.md` for known vulnerability patterns to check against
3. Read `metrics/baseline.json` to understand current quality baseline
4. Read `.github/evolution/patterns.md` for established good patterns

## Scoring Rubric

### Correctness (1-5)

| Score | Criteria |
|-------|----------|
| 5 | All claims verified, comprehensive tests, edge cases covered |
| 4 | Core behaviour correct, tests present, minor edge cases missing |
| 3 | Works for the happy path, tests exist but incomplete |
| 2 | Logical errors present, insufficient test coverage |
| 1 | Fundamentally broken or untested |

**Check**: Do tests cover the changed behaviour? Are there off-by-one errors? Does error handling work?

### Security (1-5)

| Score | Criteria |
|-------|----------|
| 5 | No new attack surface, sentinel patterns checked, secrets safe |
| 4 | Minor suggestions, no exploitable issues |
| 3 | Potential issues but low severity |
| 2 | Concrete vulnerability introduced |
| 1 | Critical security flaw (secret leak, injection, etc.) |

**Check against sentinel patterns**:
- Unbounded input reads
- Prompt injection via context delimiters
- Terminal injection via ANSI codes
- Pastejacking via clipboard content
- Secret leakage in debug logs (nested objects, arrays, JSON.stringify)
- Short-string masking failures

### Performance (1-5)

| Score | Criteria |
|-------|----------|
| 5 | Optimal for the use case, streaming preserved, no waste |
| 4 | Good performance, minor optimisation opportunities |
| 3 | Acceptable, no regressions |
| 2 | Introduces unnecessary blocking or excessive allocation |
| 1 | Breaks streaming, adds significant latency |

**Check**: Is streaming preserved in `run.ts`? Are there unnecessary `await` chains that could be parallel? Any large string concatenation in hot paths?

### Maintainability (1-5)

| Score | Criteria |
|-------|----------|
| 5 | Follows all patterns, self-documenting, docs updated |
| 4 | Consistent with codebase, minor style suggestions |
| 3 | Works but diverges from established patterns |
| 2 | Hard to understand, missing context, inconsistent style |
| 1 | Introduces dead code, circular deps, or unmaintainable patterns |

**Check**: Does it match existing provider/config/error patterns? Are imports clean? Is AGENTS.md updated if structure changed?

### Usability (1-5)

| Score | Criteria |
|-------|----------|
| 5 | Excellent UX, clear errors, consistent with existing CLI |
| 4 | Good UX, minor improvements possible |
| 3 | Functional but UX could be clearer |
| 2 | Confusing output or error messages |
| 1 | Breaks stdout contract or produces misleading output |

**Check**: stdout purity (only answer text), error messages are helpful and concise, `--help` text clear.

## Good vs Bad Reviews — Examples

### Good review feedback (specific, actionable, proportionate)

- "In `src/providers/azure.ts:45`, the `api_key_env` is logged without redaction in the error path. This matches sentinel pattern #6 (secret leakage). Suggestion: use `filterSensitiveFields()` before logging."
- "The new test in `tests/stdin.test.ts:120` covers the happy path but misses the edge case where stdin is exactly 50,000 chars (the limit). Consider adding a boundary test."
- "Score 4/5 for performance — the change is correct but `Promise.all()` could replace sequential awaits at lines 30-35 in `src/run.ts`."

### Bad review feedback (vague, unhelpful, disproportionate)

- "Code could be improved" — no specific file or suggestion
- "Consider adding more tests" — which tests? For what behaviour?
- "This is not production quality" — what specifically needs to change?
- Blocking a PR for a single missing comment

## Output Requirements

1. Score each dimension with evidence
2. Calculate overall score (average of all dimensions)
3. Deliver verdict: APPROVE (>= 4.0 overall, no dimension at 1), REQUEST_CHANGES (any dimension <= 2), COMMENT (otherwise)
4. List specific findings with file:line references
