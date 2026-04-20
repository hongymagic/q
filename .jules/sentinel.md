## 2026-04-20 - Fix exposed secrets in session context logs
**Vulnerability:** The `formatSessionContext` function in `src/logging.ts` was printing all key-value pairs stored in the `sessionContext` map to crash logs in plaintext. This included API keys and Bearer tokens passed via `updateLogContext`.
**Learning:** While other parts of the logging system correctly used `isSensitiveKey` to redact secrets, the session context map iteration was overlooked, proving that any generic mapping of context data to logs must pass through the redaction layer.
**Prevention:** Always apply the shared `isSensitiveKey` or equivalent redaction utility whenever iterating and serializing keys and values for log outputs, especially in helper functions like `formatSessionContext`.
