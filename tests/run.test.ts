import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "../src/errors.ts";
import { runQuery } from "../src/run.ts";

const mockStreamText = vi.fn();
vi.mock("ai", () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
}));

describe("runQuery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockStreamText.mockReset();
  });

  it("returns complete text from stream", async () => {
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield "hello ";
        yield "world\n";
      })(),
    });

    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const result = await runQuery({
      // @ts-expect-error - mocking model
      model: {},
      query: "test",
      systemPrompt: "test",
    });

    expect(result.text).toBe("hello world\n");
    writeSpy.mockRestore();
  });

  it("calls onFirstChunk once before writing streamed output", async () => {
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield "hello ";
        yield "world\n";
      })(),
    });

    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const onFirstChunk = vi.fn();

    await runQuery({
      // @ts-expect-error - mocking model
      model: {},
      query: "test",
      systemPrompt: "test",
      onFirstChunk,
    });

    expect(onFirstChunk).toHaveBeenCalledTimes(1);
    expect(onFirstChunk.mock.invocationCallOrder[0]).toBeLessThan(
      writeSpy.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    writeSpy.mockRestore();
  });

  it("adds trailing newline if text does not end with one", async () => {
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield "no newline";
      })(),
    });

    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await runQuery({
      // @ts-expect-error - mocking model
      model: {},
      query: "test",
      systemPrompt: "test",
    });

    const calls = writeSpy.mock.calls.map((c) => c[0]);
    expect(calls[calls.length - 1]).toBe("\n");
    writeSpy.mockRestore();
  });

  it("does not add trailing newline if text already ends with one", async () => {
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield "has newline\n";
      })(),
    });

    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await runQuery({
      // @ts-expect-error - mocking model
      model: {},
      query: "test",
      systemPrompt: "test",
    });

    const allOutput = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(allOutput).toBe("has newline\n");
    writeSpy.mockRestore();
  });

  it("wraps streamText errors in ProviderError", async () => {
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield "partial";
        throw new Error("API rate limit exceeded");
      })(),
    });

    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await expect(
      runQuery({
        // @ts-expect-error - mocking model
        model: {},
        query: "test",
        systemPrompt: "test",
      }),
    ).rejects.toThrow(ProviderError);

    writeSpy.mockRestore();
  });

  it("includes original error message in ProviderError", async () => {
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield "partial";
        throw new Error("connection timeout");
      })(),
    });

    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await expect(
      runQuery({
        // @ts-expect-error - mocking model
        model: {},
        query: "test",
        systemPrompt: "test",
      }),
    ).rejects.toThrow("AI request failed: connection timeout");

    writeSpy.mockRestore();
  });

  it("handles non-Error thrown values", async () => {
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield "partial";
        throw "string error";
      })(),
    });

    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await expect(
      runQuery({
        // @ts-expect-error - mocking model
        model: {},
        query: "test",
        systemPrompt: "test",
      }),
    ).rejects.toThrow("AI request failed: string error");

    writeSpy.mockRestore();
  });

  it("handles empty stream", async () => {
    mockStreamText.mockReturnValue({
      textStream: (async function* () {})(),
    });

    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const result = await runQuery({
      // @ts-expect-error - mocking model
      model: {},
      query: "test",
      systemPrompt: "test",
    });

    expect(result.text).toBe("");
    writeSpy.mockRestore();
  });

  it("throws when the SDK reports an error via onError", async () => {
    mockStreamText.mockImplementation(
      (opts: { onError?: (event: { error: unknown }) => void }) => {
        opts.onError?.({ error: new Error("connection refused") });

        return {
          textStream: (async function* () {})(),
        };
      },
    );

    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await expect(
      runQuery({
        // @ts-expect-error - mocking model
        model: {},
        query: "test",
        systemPrompt: "test",
      }),
    ).rejects.toThrow("AI request failed: connection refused");

    expect(writeSpy).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });

  it("adds a newline before throwing after partial streamed output", async () => {
    mockStreamText.mockImplementation(
      (opts: { onError?: (event: { error: unknown }) => void }) => {
        opts.onError?.({ error: new Error("stream interrupted") });

        return {
          textStream: (async function* () {
            yield "partial";
          })(),
        };
      },
    );

    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await expect(
      runQuery({
        // @ts-expect-error - mocking model
        model: {},
        query: "test",
        systemPrompt: "test",
      }),
    ).rejects.toThrow("AI request failed: stream interrupted");

    expect(writeSpy.mock.calls.map((call) => call[0])).toEqual([
      "partial",
      "\n",
    ]);
    writeSpy.mockRestore();
  });

  it("passes context through to user prompt", async () => {
    mockStreamText.mockImplementation((opts: { prompt: string }) => {
      expect(opts.prompt).toContain("<context>");
      expect(opts.prompt).toContain("some context data");
      expect(opts.prompt).toContain("Question: my question");
      return {
        textStream: (async function* () {
          yield "answer\n";
        })(),
      };
    });

    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await runQuery({
      // @ts-expect-error - mocking model
      model: {},
      query: "my question",
      systemPrompt: "test",
      context: "some context data",
    });

    expect(mockStreamText).toHaveBeenCalledOnce();
    writeSpy.mockRestore();
  });
});
