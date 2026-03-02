import { afterEach, describe, expect, test, vi } from "vitest";
import { sanitizeForClipboard } from "../src/ansi.ts";
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

describe("sanitizeForClipboard Security", () => {
  test("strips ANSI codes and escapes C0 control characters", () => {
    // Input containing ANSI colors, a safe LF, a safe Tab, a safe CR,
    // and dangerous C0 codes: Null (\x00), Bell (\x07), Backspace (\x08), DEL (\x7F)
    const maliciousInput =
      "Hello\u001b[31mWorld\u001b[0m\n\t\r\u0000\u0007\u0008\u007F";
    const sanitized = sanitizeForClipboard(maliciousInput);

    // ANSI codes should be stripped
    expect(sanitized).not.toContain("\u001b[31m");
    expect(sanitized).not.toContain("\u001b[0m");

    // "HelloWorld" text should be present
    expect(sanitized).toContain("HelloWorld");

    // Safe whitespace should be preserved
    expect(sanitized).toContain("\n");
    expect(sanitized).toContain("\t");
    expect(sanitized).toContain("\r");

    // Dangerous control characters should be escaped to hex (\xNN)
    expect(sanitized).toContain("\\x00");
    expect(sanitized).toContain("\\x07");
    expect(sanitized).toContain("\\x08");
    expect(sanitized).toContain("\\x7F");

    // Ensure raw C0 characters are completely gone
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally matching C0 control characters to test them
    expect(sanitized).not.toMatch(/[\x00\x07\x08\x7F]/);

    // Exact expected output
    expect(sanitized).toBe("HelloWorld\n\t\r\\x00\\x07\\x08\\x7F");
  });

  test("handles empty and plain text correctly", () => {
    expect(sanitizeForClipboard("")).toBe("");
    expect(sanitizeForClipboard("Normal text")).toBe("Normal text");
    expect(sanitizeForClipboard("Multiline\nText")).toBe("Multiline\nText");
  });
});
