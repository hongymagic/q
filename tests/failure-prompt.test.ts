import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canPromptForFailureRecovery,
  getFailurePromptAction,
  getFailurePromptMessage,
} from "../src/failure-prompt.ts";

describe("failure prompt", () => {
  it("describes all interactive options when a log is available", () => {
    expect(getFailurePromptMessage(true)).toBe(
      "Press r to retry, Enter to view the full log, or q to exit.",
    );
  });

  it("describes retry and exit when no log is available", () => {
    expect(getFailurePromptMessage(false)).toBe(
      "Press r to retry or q to exit.",
    );
  });

  it("maps supported keys to actions", () => {
    expect(getFailurePromptAction("r", true)).toBe("retry");
    expect(getFailurePromptAction("R", true)).toBe("retry");
    expect(getFailurePromptAction("\r", true)).toBe("view_log");
    expect(getFailurePromptAction("q", true)).toBe("exit");
    expect(getFailurePromptAction("", true)).toBe("exit");
  });

  it("ignores unsupported keys", () => {
    expect(getFailurePromptAction("\r", false)).toBeNull();
    expect(getFailurePromptAction("x", true)).toBeNull();
    expect(getFailurePromptAction("[A", true)).toBeNull();
  });

  it("treats Ctrl-C (\\u0003) as exit", () => {
    expect(getFailurePromptAction("", true)).toBe("exit");
  });

  it("treats LF (\\n) as view_log when a log is available", () => {
    expect(getFailurePromptAction("\n", true)).toBe("view_log");
    expect(getFailurePromptAction("\n", false)).toBeNull();
  });
});

describe("canPromptForFailureRecovery", () => {
  const originalStdoutTty = process.stdout.isTTY;
  const originalStderrTty = process.stderr.isTTY;
  const originalStdinTty = process.stdin.isTTY;
  const originalSetRawMode = process.stdin.setRawMode;

  afterEach(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalStdoutTty,
      configurable: true,
    });
    Object.defineProperty(process.stderr, "isTTY", {
      value: originalStderrTty,
      configurable: true,
    });
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalStdinTty,
      configurable: true,
    });
    process.stdin.setRawMode = originalSetRawMode;
    vi.restoreAllMocks();
  });

  function setStdio(stdoutTty: boolean, stderrTty: boolean, stdinTty: boolean) {
    Object.defineProperty(process.stdout, "isTTY", {
      value: stdoutTty,
      configurable: true,
    });
    Object.defineProperty(process.stderr, "isTTY", {
      value: stderrTty,
      configurable: true,
    });
    Object.defineProperty(process.stdin, "isTTY", {
      value: stdinTty,
      configurable: true,
    });
  }

  it("returns false when stdout is not a TTY", () => {
    setStdio(false, true, true);
    expect(canPromptForFailureRecovery()).toBe(false);
  });

  it("returns false when stderr is not a TTY", () => {
    setStdio(true, false, true);
    expect(canPromptForFailureRecovery()).toBe(false);
  });

  it("returns true when stdin is a TTY with setRawMode (interactive)", () => {
    setStdio(true, true, true);
    process.stdin.setRawMode = (() =>
      process.stdin) as typeof process.stdin.setRawMode;
    expect(canPromptForFailureRecovery()).toBe(true);
  });
});
