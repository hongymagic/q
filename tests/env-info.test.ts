import { describe, expect, it } from "vitest";
import {
  type EnvironmentInfo,
  formatEnvForDebug,
  formatEnvForPrompt,
  getEnvironmentInfo,
} from "../src/env-info.ts";

describe("Environment Detection", () => {
  describe("getEnvironmentInfo", () => {
    it("should return all required fields", () => {
      const info = getEnvironmentInfo();
      expect(info).toHaveProperty("os");
      expect(info).toHaveProperty("osVersion");
      expect(info).toHaveProperty("arch");
      expect(info).toHaveProperty("shell");
      expect(info).toHaveProperty("terminal");
    });

    it("should detect OS as macOS, Linux, Windows, or the platform name", () => {
      const info = getEnvironmentInfo();
      // Should be one of the known OS names or a platform string
      expect(typeof info.os).toBe("string");
      expect(info.os.length).toBeGreaterThan(0);
    });

    it("should detect a valid architecture", () => {
      const info = getEnvironmentInfo();
      expect(typeof info.arch).toBe("string");
      expect(info.arch.length).toBeGreaterThan(0);
    });

    it("should detect shell (never empty)", () => {
      const info = getEnvironmentInfo();
      expect(typeof info.shell).toBe("string");
      expect(info.shell.length).toBeGreaterThan(0);
    });

    it("should never throw even if detection fails", () => {
      expect(() => getEnvironmentInfo()).not.toThrow();
    });
  });

  describe("formatEnvForPrompt", () => {
    it("should format environment info correctly", () => {
      const env: EnvironmentInfo = {
        os: "macOS",
        osVersion: "14.5.0",
        arch: "arm64",
        shell: "zsh",
        terminal: "iTerm.app",
      };

      const formatted = formatEnvForPrompt(env);

      expect(formatted).toContain("OS: macOS 14.5.0 (arm64)");
      expect(formatted).toContain("Shell: zsh");
      expect(formatted).toContain("Terminal: iTerm.app");
    });

    it("should handle unknown terminal gracefully", () => {
      const env: EnvironmentInfo = {
        os: "Linux",
        osVersion: "5.15.0",
        arch: "x64",
        shell: "bash",
        terminal: "unknown",
      };

      const formatted = formatEnvForPrompt(env);
      expect(formatted).toContain("Terminal: unknown");
    });

    it("should format Windows environment correctly", () => {
      const env: EnvironmentInfo = {
        os: "Windows",
        osVersion: "10.0.19045",
        arch: "x64",
        shell: "powershell",
        terminal: "Windows Terminal",
      };

      const formatted = formatEnvForPrompt(env);
      expect(formatted).toContain("OS: Windows 10.0.19045 (x64)");
      expect(formatted).toContain("Shell: powershell");
      expect(formatted).toContain("Terminal: Windows Terminal");
    });
  });

  describe("formatEnvForDebug", () => {
    it("should format environment info as single line", () => {
      const env: EnvironmentInfo = {
        os: "macOS",
        osVersion: "14.5.0",
        arch: "arm64",
        shell: "zsh",
        terminal: "iTerm.app",
      };

      const formatted = formatEnvForDebug(env);

      expect(formatted).toContain("OS=macOS 14.5.0 (arm64)");
      expect(formatted).toContain("Shell=zsh");
      expect(formatted).toContain("Terminal=iTerm.app");
      // Should be a single line
      expect(formatted.split("\n")).toHaveLength(1);
    });
  });
});
