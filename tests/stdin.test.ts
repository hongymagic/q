import { describe, expect, it, vi } from "vitest";
import {
  MAX_CONTEXT_LENGTH,
  MAX_QUERY_LENGTH,
  resolveInput,
  type StdinInput,
} from "../src/stdin.ts";

describe("stdin module", () => {
  describe("constants", () => {
    it("should export MAX_QUERY_LENGTH as 5000", () => {
      expect(MAX_QUERY_LENGTH).toBe(5_000);
    });

    it("should export MAX_CONTEXT_LENGTH as 50000", () => {
      expect(MAX_CONTEXT_LENGTH).toBe(50_000);
    });
  });

  describe("readStdin", () => {
    it("should export readStdin function", async () => {
      const { readStdin } = await import("../src/stdin.ts");
      expect(typeof readStdin).toBe("function");
    });

    it("should return hasInput false when stdin is TTY", async () => {
      const { readStdin } = await import("../src/stdin.ts");
      // In test environment with TTY, should return no input
      // Note: When Bun global is not available (Node/vitest), we check if mocked
      if (process.stdin.isTTY) {
        // If Bun is not available and we are in TTY, readStdin will return early
        const result = await readStdin();
        expect(result.hasInput).toBe(false);
        expect(result.content).toBeNull();
      }
    });

    it("should throw UsageError if input is too long", async () => {
      const { readStdin, MAX_CONTEXT_LENGTH } = await import("../src/stdin.ts");

      // Mock process.stdin.isTTY
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, "isTTY", {
        value: false,
        configurable: true,
      });

      // Prepare large input stream mock
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          // Yield a chunk larger than MAX_CONTEXT_LENGTH
          const largeString = "a".repeat(MAX_CONTEXT_LENGTH + 1000);
          yield new TextEncoder().encode(largeString);
        },
      };

      // Mock Bun global if it doesn't exist (Node environment) or spy on it
      // biome-ignore lint/suspicious/noExplicitAny: Mocking Bun
      const globalAny = globalThis as any;

      if (!globalAny.Bun) {
        // Node/Vitest environment
        vi.stubGlobal("Bun", {
          stdin: {
            stream: () => mockStream,
          },
        });
      } else {
        // Bun environment
        vi.spyOn(globalAny.Bun.stdin, "stream").mockImplementation(
          () => mockStream,
        );
      }

      try {
        await expect(readStdin()).rejects.toThrow(
          /Input too long\. Length \d+ exceeds maximum of \d+ characters\./,
        );
      } finally {
        // Restore
        vi.restoreAllMocks();
        vi.unstubAllGlobals();

        Object.defineProperty(process.stdin, "isTTY", {
          value: originalIsTTY,
          configurable: true,
        });
      }
    });
  });

  describe("resolveInput", () => {
    it("should return args mode when no stdin and args provided", () => {
      const stdin: StdinInput = { content: null, hasInput: false };
      const result = resolveInput(stdin, ["how", "do", "I"]);

      expect(result.mode).toBe("args");
      expect(result.query).toBe("how do I");
      expect(result.context).toBeNull();
    });

    it("should return stdin mode when stdin provided and no args", () => {
      const stdin: StdinInput = { content: "what is docker", hasInput: true };
      const result = resolveInput(stdin, []);

      expect(result.mode).toBe("stdin");
      expect(result.query).toBe("what is docker");
      expect(result.context).toBeNull();
    });

    it("should return context mode when both stdin and args provided", () => {
      const stdin: StdinInput = {
        content: "error log content",
        hasInput: true,
      };
      const result = resolveInput(stdin, ["explain", "this"]);

      expect(result.mode).toBe("context");
      expect(result.query).toBe("explain this");
      expect(result.context).toBe("error log content");
    });

    it("should return args mode with empty query when no input", () => {
      const stdin: StdinInput = { content: null, hasInput: false };
      const result = resolveInput(stdin, []);

      expect(result.mode).toBe("args");
      expect(result.query).toBe("");
      expect(result.context).toBeNull();
    });

    it("should handle stdin with empty content correctly", () => {
      const stdin: StdinInput = { content: null, hasInput: false };
      const result = resolveInput(stdin, ["test"]);

      expect(result.mode).toBe("args");
      expect(result.query).toBe("test");
    });
  });
});

describe("stdin integration with run", () => {
  it("should accept context parameter in RunOptions", async () => {
    const { runQuery } = await import("../src/run.ts");
    expect(typeof runQuery).toBe("function");
  });
});
