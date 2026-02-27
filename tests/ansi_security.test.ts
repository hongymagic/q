import { afterEach, describe, expect, test, vi } from "vitest";
import * as run from "../src/run.ts";

// Mock 'ai' module
// We'll reset this per test if needed, but for now we can rely on a default mock
// or re-mock inside tests.
const mockStreamText = vi.fn();
vi.mock("ai", () => ({
  streamText: (...args: any[]) => mockStreamText(...args),
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
      model: {} as any,
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
      model: {} as any,
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
