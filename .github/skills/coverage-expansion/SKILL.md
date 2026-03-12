---
name: coverage-expansion
description: Plan-first workflow for expanding test coverage in q
---

# Coverage Expansion Skill

Use this skill when writing new tests to improve coverage of existing `q` source code.

## Mandatory Planning Sequence

Before writing tests:

1. Run `bun run test:coverage` and identify the module with the lowest coverage.
2. Read the source module to understand untested branches and code paths.
3. Review existing tests to understand mocking patterns and conventions.
4. Plan specific test cases for each untested branch.

Start implementation only after this plan is complete.

## Good vs Bad Work — Examples

### Good coverage work (targeted, meaningful, follows conventions)

- Adding tests for the error path in `src/providers/azure.ts` when `resource_name` is missing
- Testing the env var interpolation edge case in `src/config/index.ts` where a variable is not in the allowlist
- Adding a test for `src/stdin.ts` pipe detection when stdin is a TTY but stdout is not
- Testing `src/errors.ts` exit code mapping for each error type
- Covering the `--debug` flag path in `src/logging.ts` that writes to stderr

### Bad coverage work (trivial, implementation-coupled, out of scope)

- Adding `expect(true).toBe(true)` tests that don't exercise real code
- Testing private implementation details that may change
- Duplicating existing tests with slightly different input
- Writing tests that require actual API keys or network access
- Modifying source code to make it "more testable" (coverage agent writes tests only)

## Implementation Checklist

1. Use existing test patterns from `tests/*.test.ts`.
2. Use `vi.mock()` and `vi.spyOn()` consistent with existing mocks.
3. Each test must have a clear, descriptive name explaining what it verifies.
4. Tests must be deterministic — no flaky tests, no timing dependencies.
5. Group related tests with `describe()` blocks.
6. Test edge cases and error paths, not just happy paths.

## Verification Checklist

Run:

- `bun run lint`
- `bun run typecheck`
- `bun run test` (all tests pass, including new ones)
- `bun run test:coverage` (verify coverage improved for targeted module)

## Output Requirements

Report:

1. Module targeted and initial coverage percentage.
2. Number of new test cases added.
3. Final coverage percentage for the module.
4. Which specific branches/paths are now covered.
