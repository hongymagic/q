/**
 * regex to match ANSI escape codes.
 * Adapted from ansi-regex package.
 */
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = new RegExp(
  [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))",
  ].join("|"),
  "g",
);

/**
 * Strip ANSI escape codes from a string.
 * @param str The string to strip
 * @returns The string without ANSI codes
 */
export function stripAnsi(str: string): string {
  if (!str) return str;
  return str.replace(ANSI_REGEX, "");
}

/**
 * Sanitize text for the clipboard by stripping ANSI codes and escaping dangerous control characters.
 * @param str The string to sanitize
 * @returns The sanitized string safe for clipboard insertion
 */
export function sanitizeForClipboard(str: string): string {
  if (!str) return str;

  // First strip ANSI escape codes
  const stripped = stripAnsi(str);

  // Then replace dangerous control characters with their hex representation
  // We want to escape C0 control chars (0x00-0x1F) and DEL (0x7F)
  // But we want to PRESERVE safe whitespace: \t (0x09), \n (0x0A), \r (0x0D)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally matching control characters for sanitization
  return stripped.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, (char) => {
    const hex = char.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase();
    return `\\x${hex}`;
  });
}

/**
 * Creates a stateful ANSI stripper that handles split chunks.
 */
export function createAnsiStripper() {
  let buffer = "";

  return (chunk: string): string => {
    buffer += chunk;

    // If the buffer ends with a partial ANSI sequence (starts with ESC), keep it in buffer
    // ESC is \u001B or \u009B
    const lastEscIndex = Math.max(
      buffer.lastIndexOf("\u001B"),
      buffer.lastIndexOf("\u009B"),
    );

    if (lastEscIndex !== -1) {
      // Check if this looks like an incomplete sequence
      // A complete sequence usually ends with a letter or specific symbols
      // We'll process up to the last ESC, strip ANSI from that part, and keep the rest

      // Heuristic: if the sequence is very long (>50 chars), it's probably not an ANSI code, just text containing ESC
      // but to be safe and simple, we'll try to strip what we have.
      // If the regex matches the end, it's complete.

      // If it doesn't match a complete ANSI code, we wait.
      // But we need to know if it *could* be one.

      // simpler approach: process everything up to the last ESC.
      // leave the part from the last ESC in the buffer for next time.

      const safePart = buffer.slice(0, lastEscIndex);
      const remainder = buffer.slice(lastEscIndex);

      // Check if 'remainder' is a COMPLETE ANSI code
      if (ANSI_REGEX.test(remainder)) {
        // It matched completely, so we can strip it all
        const full = buffer;
        buffer = "";
        return stripAnsi(full);
      }

      // It's partial or just an ESC. Keep 'remainder' in buffer.
      buffer = remainder;
      return stripAnsi(safePart);
    }

    // No pending ESC, process everything
    const output = stripAnsi(buffer);
    buffer = "";
    return output;
  };
}
