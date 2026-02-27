import { expect, test } from "vitest";
import { stripAnsi, createAnsiStripper } from "../src/ansi.ts";

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
