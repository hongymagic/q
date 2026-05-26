// Adapted from the ansi-regex package.
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = new RegExp(
  [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?(?:\\u0007|\\u001B\\\\))",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))",
  ].join("|"),
  "g",
);

export function stripAnsi(str: string): string {
  if (!str) return str;
  return str.replace(ANSI_REGEX, "");
}

function escapeControlCharacters(str: string): string {
  // Normalise CRLF first so Windows-style line endings survive; escape any
  // remaining isolated CR because alone it overwrites the current line.
  // Then escape:
  //   - C0 control chars (0x00-0x1F) except tab (0x09) and newline (0x0A)
  //   - DEL (0x7F) and C1 control chars (0x80-0x9F)
  //   - Unicode bidi/direction-override (Trojan Source, CVE-2021-42574):
  //     U+202A-U+202E (LRE/RLE/PDF/LRO/RLO) and U+2066-U+2069 (LRI/RLI/FSI/PDI)
  const normalised = str.replace(/\r\n/g, "\n");
  return normalised.replace(
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally matching control characters for sanitization
    /[\x00-\x08\x0B-\x1F\x7F-\x9F‪-‮⁦-⁩]/g,
    (char) => {
      const code = char.charCodeAt(0);
      if (code > 0xff) {
        return `\\u${code.toString(16).toUpperCase().padStart(4, "0")}`;
      }
      return `\\x${code.toString(16).padStart(2, "0").toUpperCase()}`;
    },
  );
}

export function sanitizeForClipboard(str: string): string {
  if (!str) return str;
  return escapeControlCharacters(stripAnsi(str));
}

// Assumes ANSI codes are already stripped upstream (see createAnsiStripper for
// streaming). Use this on stdout writes to prevent terminal hijacking via raw
// control bytes (backspace, bell, isolated ESC, CR, bidi overrides) that the
// ANSI stripper does not catch.
export function sanitizeForTerminal(str: string): string {
  if (!str) return str;
  return escapeControlCharacters(str);
}

// Stateful so it can buffer partial ANSI sequences that span chunk boundaries
// (e.g. ESC arrives in chunk N and the rest in chunk N+1).
export function createAnsiStripper() {
  let buffer = "";

  return (chunk: string): string => {
    buffer += chunk;

    // If the buffer ends with a partial ANSI sequence (starts with ESC), keep it in buffer
    // ESC is \u001B or \u009B
    let lastEscIndex = Math.max(
      buffer.lastIndexOf("\u001B"),
      buffer.lastIndexOf("\u009B"),
    );

    // If the last ESC is part of an ST terminator (\u001B\\), it's not the start
    // of an incomplete sequence, it's the end of an OSC sequence. We should look
    // for the ESC that precedes it to find the actual start of a potentially
    // incomplete sequence.
    if (
      lastEscIndex !== -1 &&
      buffer.slice(lastEscIndex, lastEscIndex + 2) === "\u001B\\"
    ) {
      let checkIndex = lastEscIndex;
      while (
        checkIndex !== -1 &&
        buffer.slice(checkIndex, checkIndex + 2) === "\u001B\\"
      ) {
        checkIndex = Math.max(
          buffer.lastIndexOf("\u001B", checkIndex - 1),
          buffer.lastIndexOf("\u009B", checkIndex - 1),
        );
      }
      lastEscIndex = checkIndex;
    }

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
      // Reset lastIndex — global regexes are stateful and .test() advances it,
      // which causes false negatives on alternating calls.
      ANSI_REGEX.lastIndex = 0;
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
