import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type DoctorReport,
  formatDoctorReport,
  getConfigDir,
  getConfigPath,
  getCwdConfigPath,
  getXdgConfigDir,
  getXdgConfigPath,
} from "../src/config/index.ts";

describe("config paths", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe("getXdgConfigPath", () => {
    it("should use XDG_CONFIG_HOME when set", () => {
      process.env.XDG_CONFIG_HOME = "/custom/config";
      expect(getXdgConfigPath()).toBe("/custom/config/q/config.toml");
    });

    it("should fall back to ~/.config when XDG_CONFIG_HOME is not set", () => {
      delete process.env.XDG_CONFIG_HOME;
      const expected = join(
        process.env.HOME ?? "",
        ".config",
        "q",
        "config.toml",
      );
      expect(getXdgConfigPath()).toBe(expected);
    });
  });

  describe("getXdgConfigDir", () => {
    it("should use XDG_CONFIG_HOME when set", () => {
      process.env.XDG_CONFIG_HOME = "/custom/config";
      expect(getXdgConfigDir()).toBe("/custom/config/q");
    });

    it("should fall back to ~/.config when XDG_CONFIG_HOME is not set", () => {
      delete process.env.XDG_CONFIG_HOME;
      const expected = join(process.env.HOME ?? "", ".config", "q");
      expect(getXdgConfigDir()).toBe(expected);
    });
  });

  describe("getCwdConfigPath", () => {
    it("should return config.toml in current directory", () => {
      const expected = join(process.cwd(), "config.toml");
      expect(getCwdConfigPath()).toBe(expected);
    });
  });

  describe("getConfigPath (legacy)", () => {
    it("should return XDG config path", () => {
      delete process.env.XDG_CONFIG_HOME;
      const expected = join(
        process.env.HOME ?? "",
        ".config",
        "q",
        "config.toml",
      );
      expect(getConfigPath()).toBe(expected);
    });
  });

  describe("getConfigDir (legacy)", () => {
    it("should return XDG config dir", () => {
      delete process.env.XDG_CONFIG_HOME;
      const expected = join(process.env.HOME ?? "", ".config", "q");
      expect(getConfigDir()).toBe(expected);
    });
  });
});

describe("formatDoctorReport", () => {
  function makeReport(overrides: Partial<DoctorReport> = {}): DoctorReport {
    return {
      layers: [
        {
          source: "XDG config",
          path: "/home/user/.config/q/config.toml",
          found: true,
          data: { default: {}, providers: {} },
        },
        {
          source: "CWD config",
          path: "/project/config.toml",
          found: false,
          data: null,
        },
      ],
      envOverrides: [
        { variable: "Q_PROVIDER", value: undefined, active: false },
        { variable: "Q_MODEL", value: undefined, active: false },
        { variable: "Q_COPY", value: undefined, active: false },
      ],
      providerIssues: [],
      summary: "ok",
      ...overrides,
    };
  }

  it("should format a healthy report", () => {
    const output = formatDoctorReport(makeReport());
    expect(output).toContain("Config Doctor");
    expect(output).toContain("XDG config:");
    expect(output).toContain("(found)");
    expect(output).toContain("CWD config:");
    expect(output).toContain("(not found)");
    expect(output).toContain("Environment overrides:");
    expect(output).toContain("(none)");
    expect(output).toContain("Issues: none");
    expect(output).toContain("All checks passed.");
  });

  it("should show active environment overrides", () => {
    const output = formatDoctorReport(
      makeReport({
        envOverrides: [
          { variable: "Q_PROVIDER", value: "openai", active: true },
          { variable: "Q_MODEL", value: "gpt-4o", active: true },
          { variable: "Q_COPY", value: undefined, active: false },
        ],
      }),
    );
    expect(output).toContain("Q_PROVIDER = openai");
    expect(output).toContain("Q_MODEL = gpt-4o");
    expect(output).not.toContain("Q_COPY");
  });

  it("should show provider issues as warnings", () => {
    const output = formatDoctorReport(
      makeReport({
        providerIssues: [
          { provider: "anthropic", issue: "ANTHROPIC_API_KEY is not set" },
        ],
        summary: "warnings",
      }),
    );
    expect(output).toContain("[anthropic] ANTHROPIC_API_KEY is not set");
    expect(output).toContain("Some warnings detected");
  });

  it("should show errors summary when config fails to load", () => {
    const output = formatDoctorReport(
      makeReport({
        layers: [
          { source: "XDG config", path: "/missing", found: false, data: null },
          {
            source: "CWD config",
            path: "/also-missing",
            found: false,
            data: null,
          },
        ],
        providerIssues: [
          { provider: "(config)", issue: "Config file not found" },
        ],
        summary: "errors",
      }),
    );
    expect(output).toContain("Configuration errors found");
  });

  it("should show section names for found config layers", () => {
    const output = formatDoctorReport(
      makeReport({
        layers: [
          {
            source: "XDG config",
            path: "/home/user/.config/q/config.toml",
            found: true,
            data: { default: {}, providers: {} },
          },
        ],
      }),
    );
    expect(output).toContain("Sections: default, providers");
  });
});
