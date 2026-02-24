import { describe, expect, it } from "vitest";
import type { EnvironmentInfo } from "../src/env-info.ts";
import { buildSystemPrompt } from "../src/prompt.ts";

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

    it("should reference the user's shell in response rules", () => {
      const fishEnv: EnvironmentInfo = {
        os: "Linux",
        osVersion: "5.15.0",
        arch: "x64",
        shell: "fish",
        terminal: "xterm-256color",
      };

      const prompt = buildSystemPrompt(fishEnv, "test-date");
      expect(prompt).toContain("fish");
      expect(prompt).toContain("Linux");
    });

    it("should include one-liner preference", () => {
      const prompt = buildSystemPrompt(mockEnv, "test-date");
      expect(prompt).toMatch(/one-liner/i);
    });

    it("should include no preamble instruction", () => {
      const prompt = buildSystemPrompt(mockEnv, "test-date");
      expect(prompt).toMatch(/no preamble/i);
    });

    it("should mention shell syntax awareness", () => {
      const prompt = buildSystemPrompt(mockEnv, "test-date");
      expect(prompt).toContain("correct syntax for the user's shell (zsh)");
    });

    it("should work without arguments (uses real env and time)", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(100);
      // Should contain Date/Time line with some value
      expect(prompt).toContain("Date/Time:");
    });

    it("should include destructive operation warning rule", () => {
      const prompt = buildSystemPrompt(mockEnv, "test-date");
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
      expect(prompt).toContain("Windows");
      expect(prompt).toContain("powershell");
    });
  });
});
