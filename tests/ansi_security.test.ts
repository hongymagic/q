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

describe("sanitizeForClipboard", () => {
  test("strips ANSI escape codes", () => {
    const input = "\u001b[31mRed\u001b[0m Text";
    expect(sanitizeForClipboard(input)).toBe("Red Text");
  });

  test("preserves safe whitespace (newlines, tabs, carriage returns)", () => {
    const input = "Line 1\n\tIndented\r\nLine 2";
    expect(sanitizeForClipboard(input)).toBe(input);
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

  test("does not escape safe characters", () => {
    const input = "Normal text !@#$%^&*()_+ 1234567890";
    expect(sanitizeForClipboard(input)).toBe(input);
  });
});
