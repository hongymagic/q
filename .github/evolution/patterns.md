# Successful Patterns

Patterns extracted from merged PRs that agents should follow. Updated weekly by the self-improve workflow.

## Format

```
### <pattern-name>
**Source**: <PR number or commit>
**Pattern**: <what was done well>
**Apply when**: <when to reuse this pattern>
```

---

### Secret Redaction via JSON.stringify Replacer
**Source**: PR #59, PR #66
**Pattern**: Use a custom replacer function with `JSON.stringify` when logging objects that might contain sensitive data. Match sensitive keys by pattern (ending in `_key`, `_token`, `_secret`, or exact matches like `authorization`, `password`).
**Apply when**: Any code path that serialises objects for logging or error messages.

### XML Tags for Untrusted Content Delimiters
**Source**: Prompt injection fix (sentinel entry 2025-02-18)
**Pattern**: Use XML tags (`<context>`, `</context>`) instead of markdown backticks to delimit untrusted content in prompts. XML tags are less likely to collide with content.
**Apply when**: Wrapping user-supplied content in system or user prompts.

### Streaming Size Limits
**Source**: Unbounded stdin fix (sentinel entry 2025-02-17)
**Pattern**: Check size limits incrementally during streaming reads, not after buffering the entire input.
**Apply when**: Reading from stdin, network responses, or any unbounded input source.
