import { describe, expect, it } from "vitest";
import {
  findLatestTag,
  generatePreReleaseVersion,
  getNextPatch,
  getTodayCalVer,
  parseCalVerTag,
} from "./calver.ts";

describe("calver", () => {
  describe("getTodayCalVer", () => {
    it("returns date in YYYY.MMDD format", () => {
      const result = getTodayCalVer();
      expect(result).toMatch(/^\d{4}\.\d{4}$/);
    });

    it("returns correct format for current date", () => {
      const result = getTodayCalVer();
      const now = new Date();
      const expectedYear = now.getUTCFullYear();
      const expectedMonth = String(now.getUTCMonth() + 1).padStart(2, "0");
      const expectedDay = String(now.getUTCDate()).padStart(2, "0");
      expect(result).toBe(`${expectedYear}.${expectedMonth}${expectedDay}`);
    });
  });

  describe("parseCalVerTag", () => {
    it("parses valid CalVer tag", () => {
      const result = parseCalVerTag("v2026.0226.0");
      expect(result).toEqual({
        year: 2026,
        monthDay: "0226",
        patch: 0,
      });
    });

    it("parses tag with higher patch number", () => {
      const result = parseCalVerTag("v2026.1225.42");
      expect(result).toEqual({
        year: 2026,
        monthDay: "1225",
        patch: 42,
      });
    });

    it("returns null for invalid tag format", () => {
      expect(parseCalVerTag("v1.2.3")).toBeNull();
      expect(parseCalVerTag("2026.0226.0")).toBeNull(); // Missing 'v' prefix
      expect(parseCalVerTag("v2026.02.26.0")).toBeNull(); // Wrong format
      expect(parseCalVerTag("")).toBeNull();
      expect(parseCalVerTag("invalid")).toBeNull();
    });

    it("returns null for pre-release tags", () => {
      // Pre-release tags don't match the strict CalVer regex
      expect(parseCalVerTag("v2026.0226.0-next.abc1234")).toBeNull();
    });
  });

  describe("getNextPatch", () => {
    it("returns 0 when no latest tag exists", () => {
      expect(getNextPatch(null)).toBe(0);
    });

    it("increments patch from 0 to 1", () => {
      expect(getNextPatch("v2026.0226.0")).toBe(1);
    });

    it("increments patch from 5 to 6", () => {
      expect(getNextPatch("v2026.0226.5")).toBe(6);
    });

    it("increments high patch numbers", () => {
      expect(getNextPatch("v2026.0226.99")).toBe(100);
    });

    it("returns 0 for invalid tag format", () => {
      expect(getNextPatch("invalid")).toBe(0);
      expect(getNextPatch("v1.2.3")).toBe(0);
    });
  });

  describe("findLatestTag", () => {
    it("returns null for empty array", () => {
      expect(findLatestTag([])).toBeNull();
    });

    it("returns null for array with only empty strings", () => {
      expect(findLatestTag(["", "  ", "\n"])).toBeNull();
    });

    it("returns the only tag when single tag provided", () => {
      expect(findLatestTag(["v2026.0226.0"])).toBe("v2026.0226.0");
    });

    it("returns the highest patch tag", () => {
      const tags = ["v2026.0226.0", "v2026.0226.2", "v2026.0226.1"];
      expect(findLatestTag(tags)).toBe("v2026.0226.2");
    });

    it("excludes pre-release tags", () => {
      const tags = [
        "v2026.0226.0",
        "v2026.0226.1-next.abc1234",
        "v2026.0226.1",
      ];
      expect(findLatestTag(tags)).toBe("v2026.0226.1");
    });

    it("trims whitespace from tags", () => {
      const tags = ["  v2026.0226.0  ", "\nv2026.0226.1\n"];
      expect(findLatestTag(tags)).toBe("v2026.0226.1");
    });
  });

  describe("generatePreReleaseVersion", () => {
    it("generates correct pre-release version", () => {
      const result = generatePreReleaseVersion("2026.0226", 0, "abc1234");
      expect(result).toBe("2026.0226.0-next.abc1234");
    });

    it("works with non-zero patch", () => {
      const result = generatePreReleaseVersion("2026.0226", 5, "def5678");
      expect(result).toBe("2026.0226.5-next.def5678");
    });
  });
});
