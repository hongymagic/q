---
name: security-patch
description: Plan-first workflow for implementing security patches safely in q
---

# Security Patch Skill

Use this skill for any security patch, vulnerability hardening, or abuse-prevention change in `q`.

## Mandatory Planning Sequence

Complete this sequence before editing files:

1. Define the threat model (who can abuse what surface).
2. Identify impacted trust boundaries (stdin, config, env vars, network calls, model output handling).
3. Choose the smallest safe remediation.
4. Define validation criteria before implementation.

Do not skip this planning sequence.

## Good vs Bad Work — Examples

### Good security work (concrete, testable, product code)

- Adding input length validation to `src/stdin.ts` to prevent memory exhaustion from oversized piped input
- Ensuring `src/providers/portkey.ts` does not log the `Authorization` header value in debug mode
- Adding a test to verify that `src/config/index.ts` rejects env var interpolation for variables not in the allowlist
- Fixing `src/errors.ts` to redact API key values from error messages before printing to stderr

### Bad security work (vague, meta, out of scope)

- "Improve overall security posture" — no specific file or attack vector
- "Add security headers to workflow files" — workflow files are out of scope
- "Audit all dependencies for CVEs" — dependency management is handled separately
- "Implement RBAC for the CLI" — not relevant to this single-user CLI tool

## Implementation Checklist

1. Preserve existing behaviour for non-malicious inputs.
2. Add explicit guards and clear errors for unsafe inputs.
3. Avoid leaking secrets in logs, errors, or tests.
4. Keep diffs small and focused.
5. Update docs when behaviour or security assumptions change.

## Verification Checklist

Run:

- `bun run lint`
- `bun run typecheck`
- `bun run test`

If any check is skipped, provide a clear reason and follow-up action.

## Output Requirements

Report:

1. Threat addressed.
2. Why the chosen fix is minimal and sufficient.
3. Validation results and residual risk.
