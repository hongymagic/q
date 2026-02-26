# Code Review: 6a68b0b — Fix prompt injection in context

**Commit:** `6a68b0b`
**Title:** 🛡️ Sentinel: [HIGH] Fix prompt injection in context (#7)
**Reviewer:** claude/review-last-commit-vgEtu
**Date:** 2026-02-26
**Verdict:** ✅ Approve

---

## Summary

The `q` CLI builds prompts by wrapping user-supplied context (piped stdin or `-c` flag) in a delimiter before sending to an LLM. The previous delimiter was a markdown code block (` ```...``` `). An attacker controlling the context data could inject triple backticks to break out of the fence and add arbitrary instructions to the prompt.

This commit replaces the markdown fence with XML tags and escapes the closing tag in user input to prevent injection.

---

## File-by-file Review

### `src/prompt.ts` — Core Fix ✅

```ts
// Line 98
const safeContext = context.replace(/<\/context>/gi, "<\\/context>");
```

**Correct.** Key observations:

- The regex uses the `g` (global) flag — all occurrences of `</context>` in the input are replaced, not just the first. No `.replaceAll()` needed.
- The `i` (case-insensitive) flag handles variants like `</Context>` or `</CONTEXT>`.
- The replacement `<\\/context>` produces the literal string `<\/context>` in the output, which breaks the closing tag without destroying readability.
- XML tag delimiters are idiomatic for LLM prompts (Claude's own API conventions use them). This is an improvement over markdown fences for this use case.

**Minor:** The comment on line 97 says "break the closing tag" but does not explain _why_ a backslash was chosen over standard XML escaping (`&lt;/context&gt;`). A one-line note would help future maintainers. That said, the backslash approach is pragmatically fine for LLM prompt injection prevention (the model reads it as an escaped sequence, not a tag boundary).

---

### `tests/prompt_injection.test.ts` — New Security Test ✅

Covers:
1. Nested backtick injection (the old attack vector)
2. Closing XML tag injection (`</context>`)
3. Content preservation after sanitization

The test uses `vitest` (note: `CLAUDE.md` specifies `bun test` / `bun:test` for this project — this is pre-existing inconsistency, not introduced by this commit).

**Suggestion (non-blocking):** Add a test for multiple `</context>` occurrences in a single input to explicitly document the global-replace behaviour:

```ts
test("escapes multiple closing tags", () => {
  const ctx = "</context>foo</context>";
  const prompt = buildUserPrompt("q", ctx);
  expect(prompt.match(/<\/context>/g)?.length).toBe(1); // only the real closing tag
});
```

---

### `tests/prompt.test.ts` — Updated Assertions ✅

Updated from backtick expectations to XML tag expectations. Straightforward and correct.

---

### `.jules/sentinel.md` — Security Incident Log ✅

Clear documentation of the vulnerability class, root cause analysis, and fix rationale. Good practice.

---

## Issues

| Severity | File | Finding |
|----------|------|---------|
| Low | `src/prompt.ts:97` | Comment doesn't explain why backslash escaping was chosen over `&lt;/context&gt;` |
| Low | `tests/prompt_injection.test.ts` | No test for multiple `</context>` occurrences (global regex is correct, just undocumented) |
| Info | `tests/prompt_injection.test.ts:1` | Uses `vitest` instead of `bun:test` per project conventions (pre-existing issue) |

---

## Overall

The fix is technically sound, well-scoped, and follows established LLM security patterns. The global case-insensitive regex ensures complete sanitization. Tests cover the relevant attack surface. Minor documentation gaps are non-blocking.
