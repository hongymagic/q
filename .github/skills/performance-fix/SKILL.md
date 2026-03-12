---
name: performance-fix
description: Plan-first workflow for implementing performance improvements in q
---

# Performance Fix Skill

Use this skill for any performance improvement, optimisation, or size reduction change in `q`.

## Mandatory Planning Sequence

Complete this sequence before editing files:

1. Measure the current baseline (binary size, test duration, or specific metric).
2. Identify the bottleneck or regression with evidence (not assumptions).
3. Choose the smallest effective remediation.
4. Define measurable success criteria (e.g., "binary size decreases by >5%").

Do not skip this planning sequence.

## Good vs Bad Work — Examples

### Good performance work (measured, concrete, product code)

- Removing an unused provider import from `src/providers/index.ts` that pulls in a heavy SDK at startup
- Replacing synchronous file reads with async alternatives in `src/config/index.ts` to improve startup time
- Lazy-loading provider SDKs so only the selected provider is imported at runtime
- Removing dead code paths in `src/run.ts` that allocate buffers for unused features
- Adding a test that asserts binary size stays below a threshold

### Bad performance work (unmeasured, speculative, out of scope)

- "Optimise the codebase for speed" — no specific metric or file
- "Switch to a faster JSON parser" — adding dependencies for marginal gain
- "Rewrite the config loader in Rust" — out of scope, not incremental
- "Cache everything" — premature optimisation without measured need
- "Micro-optimise string concatenation" — negligible impact on CLI startup

## Implementation Checklist

1. Measure baseline before any changes.
2. Make the smallest change that achieves the improvement.
3. Verify the improvement with the same measurement method.
4. Ensure no functional regression (all tests pass).
5. Document before/after metrics in the PR description.

## Verification Checklist

Run:

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build` (measure output size)

If any check is skipped, provide a clear reason and follow-up action.

## Output Requirements

Report:

1. Baseline measurement and methodology.
2. Post-change measurement.
3. Percentage improvement.
4. Any trade-offs or residual concerns.
