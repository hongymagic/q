/**
 * Shared patterns for identifying sensitive field names across logging and
 * provider modules. Intentionally broad — false positives (e.g. "primaryKey")
 * are acceptable because redacting harmless data is far better than leaking
 * real secrets.
 */
const SENSITIVE_KEY_PATTERNS = [
  "key",
  "secret",
  "token",
  "password",
  "auth",
  "credential",
  "authorization",
];

export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}
