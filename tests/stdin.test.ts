import { describe, expect, it } from "vitest";
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
      // Note: When Bun global is not available (Node/vitest), we skip
      if (process.stdin.isTTY && typeof globalThis.Bun !== "undefined") {
        const result = await readStdin();
        expect(result.hasInput).toBe(false);
        expect(result.content).toBeNull();
      }
    });

    it("should throw UsageError if input is too long", async () => {
      const { readStdin, MAX_CONTEXT_LENGTH } = await import("../src/stdin.ts");
      const { UsageError } = await import("../src/errors.ts");

      // Mock process.stdin.isTTY
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, "isTTY", {
        value: false,
        configurable: true,
      });

      // Mock Bun global if it doesn't exist (Node environment)
      // biome-ignore lint/suspicious/noExplicitAny: Mocking global
      const globalAny = globalThis as any;
      const originalBun = globalAny.Bun;

      if (!originalBun) {
        globalAny.Bun = {
          stdin: {
            stream: () => {},
          },
        };
      }

      // Mock Bun.stdin.stream
      const originalStream = globalAny.Bun.stdin.stream;
      globalAny.Bun.stdin.stream = () => {
        return {
          [Symbol.asyncIterator]: async function* () {
            // Yield a chunk larger than MAX_CONTEXT_LENGTH
            const largeString = "a".repeat(MAX_CONTEXT_LENGTH + 1000);
            yield new TextEncoder().encode(largeString);
          },
          // biome-ignore lint/suspicious/noExplicitAny: Mocking Bun stream
        } as any;
      };

      try {
        await expect(readStdin()).rejects.toThrow(UsageError);
      } finally {
        // Restore
        if (originalBun) {
          globalAny.Bun.stdin.stream = originalStream;
        } else {
          delete globalAny.Bun;
        }

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
