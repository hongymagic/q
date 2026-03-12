import { describe, expect, test } from "vitest";
import { sanitizeForClipboard } from "../src/ansi.ts";

describe("sanitizeForClipboard", () => {
  test("returns empty string for empty input", () => {
    expect(sanitizeForClipboard("")).toBe("");
  });

  test("strips various ANSI escape codes", () => {
    const inputs = [
      "\u001b[31mRed\u001b[0m", // Basic color
      "\u001b[1mBold\u001b[22m", // Style
      "\u001b[4mUnderline\u001b[24m", // Underline
      "\u001b[38;5;214mOrange\u001b[0m", // 256 color
      "\u001b[38;2;255;0;0mTrueColor\u001b[0m", // RGB
      "\u001b[?25lHide Cursor", // Private mode
    ];

    expect(sanitizeForClipboard(inputs[0])).toBe("Red");
    expect(sanitizeForClipboard(inputs[1])).toBe("Bold");
    expect(sanitizeForClipboard(inputs[2])).toBe("Underline");
    expect(sanitizeForClipboard(inputs[3])).toBe("Orange");
    expect(sanitizeForClipboard(inputs[4])).toBe("TrueColor");
    expect(sanitizeForClipboard(inputs[5])).toBe("Hide Cursor");
  });

  test("escapes dangerous C0 control characters but preserves safe ones", () => {
    // Safe ones: \t (0x09), \n (0x0A), \r (0x0D)
    // Others should be escaped
    const input = "\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0B\x0C\r\x0E\x0F";
    const expected =
      "\\x00\\x01\\x02\\x03\\x04\\x05\\x06\\x07\\x08\t\n\\x0B\\x0C\r\\x0E\\x0F";
    expect(sanitizeForClipboard(input)).toBe(expected);
  });

  test("escapes C1 control characters and DEL", () => {
    // DEL (0x7F), C1 (0x80-0x9F)
    const input = "\x7f\x80\x90\x9f";
    const expected = "\\x7F\\x80\\x90\\x9F";
    expect(sanitizeForClipboard(input)).toBe(expected);
  });

  test("preserves non-control Unicode characters", () => {
    const input = "Hello 🌍! こんいちは! 🚀";
    expect(sanitizeForClipboard(input)).toBe(input);
  });

  test("handles mixed ANSI and control characters", () => {
    const input = "\u001b[31mError:\u001b[0m Critical\x07 failure!\nCheck \x08logs.";
    // ANSI stripped: "Error: Critical\x07 failure!\nCheck \x08logs."
    // Control escaped: "Error: Critical\\x07 failure!\nCheck \\x08logs."
    const expected = "Error: Critical\\x07 failure!\nCheck \\x08logs.";
    expect(sanitizeForClipboard(input)).toBe(expected);
  });

  test("handles strings with only control characters", () => {
    const input = "\x01\x02\x03";
    expect(sanitizeForClipboard(input)).toBe("\\x01\\x02\\x03");
  });

  test("handles strings with only ANSI codes", () => {
    const input = "\u001b[31m\u001b[0m";
    expect(sanitizeForClipboard(input)).toBe("");
  });

  test("escapes raw ESC if not part of a valid ANSI sequence", () => {
    // ANSI_REGEX might not match a lone ESC depending on its definition
    // In src/ansi.ts, sanitizeForClipboard first calls stripAnsi
    // Then it escapes control characters including 0x1b
    const input = "Just an ESC: \x1b";
    expect(sanitizeForClipboard(input)).toBe("Just an ESC: \\x1B");
  });
});
