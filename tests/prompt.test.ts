import { describe, expect, it } from "vitest";
import type { EnvironmentInfo } from "../src/env-info.ts";
import { buildSystemPrompt, buildUserPrompt } from "../src/prompt.ts";

describe("System Prompt", () => {
  describe("buildSystemPrompt", () => {
    const mockEnv: EnvironmentInfo = {
      os: "macOS",
      osVersion: "14.5.0",
      arch: "arm64",
      shell: "zsh",
      terminal: "iTerm.app",
    };

    it("should include environment context", () => {
      const prompt = buildSystemPrompt(
        mockEnv,
        "Mon, Jan 1, 2024, 12:00 PM PST",
      );

      expect(prompt).toContain("macOS 14.5.0 (arm64)");
      expect(prompt).toContain("Shell: zsh");
      expect(prompt).toContain("Terminal: iTerm.app");
    });

    it("should include date/time when provided", () => {
      const prompt = buildSystemPrompt(
        mockEnv,
        "Mon, Jan 1, 2024, 12:00 PM PST",
      );
      expect(prompt).toContain("Date/Time: Mon, Jan 1, 2024, 12:00 PM PST");
    });

    it("should reference the user's shell and OS in rules", () => {
      const fishEnv: EnvironmentInfo = {
        os: "Linux",
        osVersion: "5.15.0",
        arch: "x64",
        shell: "fish",
        terminal: "xterm-256color",
      };

      const prompt = buildSystemPrompt(fishEnv, "test-date");
      expect(prompt).toContain("fish syntax for Linux");
    });

    it("should include one-liner preference", () => {
      const prompt = buildSystemPrompt(mockEnv, "test-date");
      expect(prompt).toMatch(/one-liner/i);
    });

    it("should include no preamble instruction", () => {
      const prompt = buildSystemPrompt(mockEnv, "test-date");
      expect(prompt).toMatch(/no preamble/i);
    });

    it("should work without arguments (uses real env and time)", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(100);
      expect(prompt).toContain("Date/Time:");
    });

    it("should include destructive operation warning rule", () => {
      const prompt = buildSystemPrompt(mockEnv, "test-date");
      expect(prompt).toContain("WARNING:");
      expect(prompt).toContain("destructive");
    });

    it("should handle Windows environment", () => {
      const winEnv: EnvironmentInfo = {
        os: "Windows",
        osVersion: "10.0.19045",
        arch: "x64",
        shell: "powershell",
        terminal: "Windows Terminal",
      };

      const prompt = buildSystemPrompt(winEnv, "test-date");
      expect(prompt).toContain("powershell syntax for Windows");
    });

    it("should instruct plain text output (no markdown)", () => {
      const prompt = buildSystemPrompt(mockEnv, "test-date");
      expect(prompt).toMatch(/plain text/i);
      expect(prompt).toMatch(/never use markdown/i);
    });

    it("should include multi-shot examples", () => {
      const prompt = buildSystemPrompt(mockEnv, "test-date");
      expect(prompt).toContain("<examples>");
      expect(prompt).toContain("</examples>");
      expect(prompt).toContain("User:");
      expect(prompt).toContain("Output:");
    });

    it("should explicitly forbid backticks and code fences", () => {
      const prompt = buildSystemPrompt(mockEnv, "test-date");
      expect(prompt).toContain("backticks");
      expect(prompt).toContain("code fences");
    });
  });

  describe("buildUserPrompt", () => {
    it("should return query as-is when no context", () => {
      const result = buildUserPrompt("what is docker");
      expect(result).toBe("what is docker");
    });

    it("should return query as-is when context is null", () => {
      const result = buildUserPrompt("what is docker", null);
      expect(result).toBe("what is docker");
    });

    it("should return query as-is when context is undefined", () => {
      const result = buildUserPrompt("what is docker", undefined);
      expect(result).toBe("what is docker");
    });

    it("should wrap context in code block with question", () => {
      const result = buildUserPrompt("explain this", "const x = 1;");
      expect(result).toContain("<context>");
      expect(result).toContain("const x = 1;");
      expect(result).toContain("</context>");
      expect(result).toContain("Question: explain this");
    });

    it("should preserve multiline context", () => {
      const context = "line 1\nline 2\nline 3";
      const result = buildUserPrompt("explain", context);
      expect(result).toContain("line 1\nline 2\nline 3");
    });
  });
});
