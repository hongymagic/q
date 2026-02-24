import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getConfigDir,
  getConfigPath,
  getCwdConfigPath,
  getXdgConfigDir,
  getXdgConfigPath,
} from "../src/config/index.ts";

describe("config paths", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getXdgConfigPath", () => {
    it("should use XDG_CONFIG_HOME when set", () => {
      process.env.XDG_CONFIG_HOME = "/custom/config";
      expect(getXdgConfigPath()).toBe("/custom/config/q/config.toml");
    });

    it("should fall back to ~/.config when XDG_CONFIG_HOME is not set", () => {
      delete process.env.XDG_CONFIG_HOME;
      const expected = join(homedir(), ".config", "q", "config.toml");
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
      const expected = join(homedir(), ".config", "q");
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
      const expected = join(homedir(), ".config", "q", "config.toml");
      expect(getConfigPath()).toBe(expected);
    });
  });

  describe("getConfigDir (legacy)", () => {
    it("should return XDG config dir", () => {
      delete process.env.XDG_CONFIG_HOME;
      const expected = join(homedir(), ".config", "q");
      expect(getConfigDir()).toBe(expected);
    });
  });
});
