const SENSITIVE_FIELD_PATTERNS = [
  "key",
  "secret",
  "token",
  "password",
  "auth",
  "credential",
];

function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => lowerKey.includes(pattern));
}

/**
 * Filter sensitive fields from a provider config for safe logging.
 * Removes any field containing: key, secret, token, password, auth, credential.
 * Also recursively filters nested objects like headers.
 */
export function filterSensitiveFields(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (isSensitiveKey(key)) {
      continue;
    }

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      result[key] = filterSensitiveFields(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}
