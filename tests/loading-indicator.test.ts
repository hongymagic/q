import { afterEach, describe, expect, it, vi } from "vitest";
import { startLoadingIndicator } from "../src/loading-indicator.ts";

describe("startLoadingIndicator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders frames and clears them on stop", () => {
    vi.useFakeTimers();

    const writes: string[] = [];
    const indicator = startLoadingIndicator({
      intervalMs: 50,
      stream: {
        isTTY: true,
        write(chunk: string) {
          writes.push(chunk);
          return true;
        },
      },
      text: "Working...",
    });

    expect(writes).toEqual(["\r- Working..."]);

    vi.advanceTimersByTime(100);

    expect(writes).toEqual([
      "\r- Working...",
      "\r\\ Working...",
      "\r| Working...",
    ]);

    indicator.stop();

    expect(writes[writes.length - 1]).toBe("\r            \r");
  });

  it("does nothing when the stream is not a TTY", () => {
    const write = vi.fn();

    const indicator = startLoadingIndicator({
      stream: {
        isTTY: false,
        write,
      },
    });

    indicator.stop();

    expect(write).not.toHaveBeenCalled();
  });
});
