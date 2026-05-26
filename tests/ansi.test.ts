import { expect, test } from "vitest";
import { createAnsiStripper } from "../src/ansi.ts";

test("createAnsiStripper handles split chunks", () => {
  const stripper = createAnsiStripper();

  // Test 1: Complete ANSI sequence in one chunk
  expect(stripper("\u001b[31mRed\u001b[0m")).toBe("Red");

  // Test 2: Split ANSI sequence across chunks
  // Sequence: \u001b[31m
  expect(stripper("Text")).toBe("Text");
  expect(stripper("\u001b")).toBe(""); // Should hold ESC
  expect(stripper("[31m")).toBe(""); // Should complete and strip
  expect(stripper("Green")).toBe("Green");
});

test("createAnsiStripper handles repeated complete ANSI sequences without false negatives", () => {
  // Regression: global regex .test() advances lastIndex, causing alternating
  // calls to return false negatives. Each iteration delivers a complete ANSI
  // sequence that should be fully stripped.
  const stripper = createAnsiStripper();

  for (let i = 0; i < 6; i++) {
    expect(stripper(`\u001b[31mLine${i}\u001b[0m`)).toBe(`Line${i}`);
  }
});

test("createAnsiStripper handles alternating plain text and ANSI chunks", () => {
  const stripper = createAnsiStripper();

  expect(stripper("plain")).toBe("plain");
  expect(stripper("\u001b[32mgreen\u001b[0m")).toBe("green");
  expect(stripper("more plain")).toBe("more plain");
  expect(stripper("\u001b[33myellow\u001b[0m")).toBe("yellow");
  expect(stripper("final")).toBe("final");
});

test("createAnsiStripper handles ST sequences", () => {
  const stripper = createAnsiStripper();
  // String terminated with ST sequence (\u001b\)
  const stSequence =
    "\u001b]8;;http://example.com\u001b\\Link\u001b]8;;\u001b\\";

  // Depending on whether it splits or is in one chunk, the result should be just the link text
  expect(stripper(stSequence)).toBe("Link");
});
