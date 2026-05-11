import { afterEach, describe, expect, test, vi } from "vitest";
import { sanitizeForClipboard, sanitizeForTerminal } from "../src/ansi.ts";
import * as run from "../src/run.ts";

// Mock 'ai' module
// We'll reset this per test if needed, but for now we can rely on a default mock
// or re-mock inside tests.
const mockStreamText = vi.fn();
vi.mock("ai", () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
}));

describe("runQuery Security", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockStreamText.mockReset();
  });

  test("strips ANSI codes from stdout but keeps them in returned text", async () => {
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield "echo ";
        yield "\u001b[31m"; // ANSI red
        yield "safe";
        yield "\u001b[0m"; // Reset
      })(),
    });

    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const result = await run.runQuery({
      // @ts-expect-error - mocking model
      model: {},
      query: "test",
      systemPrompt: "test",
    });

    // Check what was returned - SHOULD CONTAIN ANSI (for clipboard)
    expect(result.text).toBe("echo \u001b[31msafe\u001b[0m");

    // Check what was written to stdout - SHOULD NOT CONTAIN ANSI
    const calls = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(calls).not.toContain("\u001b[31m");
    expect(calls).toContain("echo safe");
  });

  test("escapes raw control characters in stdout output", async () => {
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield "Hello\x08\x08\x08\x08\x08FAKE";
        yield "\x07Bell";
        yield "\x1bRawEsc";
      })(),
    });

    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const result = await run.runQuery({
      // @ts-expect-error - mocking model
      model: {},
      query: "test",
      systemPrompt: "test",
    });

    const stdoutContent = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(stdoutContent).not.toContain("\x08");
    expect(stdoutContent).not.toContain("\x07");
    expect(stdoutContent).toContain("\\x08");
    expect(stdoutContent).toContain("\\x07");

    // Return value (used for clipboard) keeps the raw text
    expect(result.text).toContain("\x08");
  });

  test("handles split ANSI sequences across chunks", async () => {
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield "Start";
        yield "\u001b"; // Split ESC
        yield "[31m"; // Rest of sequence
        yield "Red";
        yield "\u001b[0m";
      })(),
    });

    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const result = await run.runQuery({
      // @ts-expect-error - mocking model
      model: {},
      query: "test",
      systemPrompt: "test",
    });

    // stdout should be clean
    const stdoutContent = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(stdoutContent).toBe("StartRed\n");

    // return value should have codes
    expect(result.text).toBe("Start\u001b[31mRed\u001b[0m");
  });
});

describe("sanitizeForClipboard", () => {
  test("strips ANSI escape codes", () => {
    const input = "\u001b[31mRed\u001b[0m Text";
    expect(sanitizeForClipboard(input)).toBe("Red Text");
  });

  test("strips ANSI OSC sequences with String Terminator (ST)", () => {
    const input =
      "\u001b]8;;http://malicious.com\u001b\\Malicious Link\u001b]8;;\u001b\\";
    expect(sanitizeForClipboard(input)).toBe("Malicious Link");
  });

  test("preserves tab and newline; normalises CRLF to LF", () => {
    expect(sanitizeForClipboard("Line 1\n\tIndented\r\nLine 2")).toBe(
      "Line 1\n\tIndented\nLine 2",
    );
  });

  test("escapes isolated carriage return to prevent terminal overwrite", () => {
    expect(sanitizeForClipboard("safe\rEVIL")).toBe("safe\\x0DEVIL");
  });

  test("escapes dangerous C0 control characters to hex representation", () => {
    const input = "Null\x00 Bell\x07 Backspace\x08 Escape\x1b";
    // The ANSI code stripper will catch Escape if it's part of a sequence,
    // but just the raw ESC char (0x1b) without sequence gets escaped to \x1B
    expect(sanitizeForClipboard(input)).toBe(
      "Null\\x00 Bell\\x07 Backspace\\x08 Escape\\x1B",
    );
  });

  test("escapes DEL character (0x7F)", () => {
    const input = "Delete\x7f";
    expect(sanitizeForClipboard(input)).toBe("Delete\\x7F");
  });

  test("escapes C1 control character U+009B (CSI)", () => {
    const input = "CSI\u009B Test";
    expect(sanitizeForClipboard(input)).toBe("CSI\\x9B Test");
  });

  test("escapes Unicode bidi/direction-override characters", () => {
    expect(sanitizeForClipboard("hello‮world")).toBe("hello\\u202Eworld");
  });

  test("does not escape safe characters", () => {
    const input = "Normal text !@#$%^&*()_+ 1234567890";
    expect(sanitizeForClipboard(input)).toBe(input);
  });
});

describe("sanitizeForTerminal", () => {
  test("escapes C0 control characters except safe whitespace", () => {
    expect(sanitizeForTerminal("Bell\x07")).toBe("Bell\\x07");
    expect(sanitizeForTerminal("Backspace\x08")).toBe("Backspace\\x08");
    expect(sanitizeForTerminal("RawEsc\x1b")).toBe("RawEsc\\x1B");
    expect(sanitizeForTerminal("Null\x00")).toBe("Null\\x00");
  });

  test("escapes DEL and C1 control characters", () => {
    expect(sanitizeForTerminal("Delete\x7f")).toBe("Delete\\x7F");
    expect(sanitizeForTerminal("CSI")).toBe("CSI\\x9B");
  });

  test("preserves tab and newline; normalises CRLF to LF", () => {
    expect(sanitizeForTerminal("Line 1\n\tIndented\r\nLine 2")).toBe(
      "Line 1\n\tIndented\nLine 2",
    );
  });

  test("escapes isolated CR (terminal overwrite vector)", () => {
    // \r alone returns the cursor to column 0, letting a malicious model
    // overwrite previously displayed text. Must be escaped.
    expect(sanitizeForTerminal("safe command\rrm -rf /")).toBe(
      "safe command\\x0Drm -rf /",
    );
  });

  test("escapes Unicode bidi/direction-override characters (Trojan Source)", () => {
    // U+202E (RLO) flips visual text direction — the classic Trojan Source attack.
    // What looks like "git push origin main" can actually be a different command.
    expect(sanitizeForTerminal("safe‮evil")).toBe("safe\\u202Eevil");
    expect(sanitizeForTerminal("‪text‬")).toBe("\\u202Atext\\u202C");
    expect(sanitizeForTerminal("⁦isolate⁩")).toBe("\\u2066isolate\\u2069");
    // All 9 bidi controls
    for (const code of [
      0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
    ]) {
      const char = String.fromCharCode(code);
      expect(sanitizeForTerminal(char)).toMatch(/^\\u[0-9A-F]{4}$/);
    }
  });

  test("does not strip ANSI codes (caller is expected to strip them upstream)", () => {
    // sanitizeForTerminal assumes the streaming ANSI stripper has already run.
    // For inputs like raw ESC followed by [, the ESC alone is escaped but [ stays.
    expect(sanitizeForTerminal("\x1b[31m")).toBe("\\x1B[31m");
  });

  test("returns empty string unchanged", () => {
    expect(sanitizeForTerminal("")).toBe("");
  });
});
