export const SENSITIVE_FIELD_PATTERNS = [
  "key",
  "secret",
  "token",
  "password",
  "auth",
  "credential",
];

export function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => lowerKey.includes(pattern));
}

/**
 * Filter sensitive fields from a provider config for safe logging.
 * Removes sensitive fields recursively using a JSON replacer to safely
 * handle arrays and nested objects without mutating the original.
 * @internal Exported for testing only
 */
export function filterSensitiveFields(
  config: Record<string, unknown>,
): Record<string, unknown> {
  try {
    return JSON.parse(
      JSON.stringify(config, (key, value) => {
        if (!key) {
          return value;
        }
        return isSensitiveKey(key) ? undefined : value;
      }),
    );
  } catch {
    return {};
  }
}
