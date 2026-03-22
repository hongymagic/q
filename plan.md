1. **Update `isSensitiveKey` in `src/logging.ts`**:
   - Make it robust by handling camelCase and splitting by underscores and hyphens (as mentioned in the memory).
   - Export it.
2. **Update `redactValue` in `src/logging.ts`**:
   - Mask values unconditionally with `********` regardless of length.
3. **Refactor `src/providers/index.ts`**:
   - Remove its custom (and overly broad) `isSensitiveKey` implementation.
   - Import and use `isSensitiveKey` from `src/logging.ts`.
4. **Update `src/providers/portkey.ts`**:
   - Import and use `isSensitiveKey` from `src/logging.ts`.
   - Unconditionally mask sensitive values with `********`.
5. **Complete pre commit steps**:
   - ensure proper testing, verification, review, and reflection are done.
6. **Submit PR**:
   - Use title '🛡️ Sentinel: [CRITICAL/HIGH] Fix Partial Credential Leakage & Broad Redaction'
