import { describe, expect, it } from "vitest";
import {
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
    expect(getFailurePromptAction("\u001b", true)).toBe("exit");
  });

  it("ignores unsupported keys", () => {
    expect(getFailurePromptAction("\r", false)).toBeNull();
    expect(getFailurePromptAction("x", true)).toBeNull();
    expect(getFailurePromptAction("\u001b[A", true)).toBeNull();
  });
});
