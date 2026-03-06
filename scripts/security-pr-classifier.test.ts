import { describe, expect, it } from "vitest";
import {
  BOILERPLATE_PATTERNS,
  classifySecurityPR,
  SECURITY_LABELS,
  SECURITY_TITLE_PREFIXES,
  stripBoilerplate,
} from "./security-pr-classifier.ts";

describe("security-pr-classifier", () => {
  // ──────────────────────────────────────────────
  // TRUE POSITIVES — should be classified as security PRs
  // ──────────────────────────────────────────────
  describe("true positives", () => {
    it("detects [security] title prefix", () => {
      const result = classifySecurityPR({
        title: "[security] fix path traversal in config loader",
        labels: [],
        body: "This PR fixes a path traversal vulnerability.",
      });
      expect(result.isSecurityPR).toBe(true);
      expect(result.reason).toContain("[security]");
    });

    it("detects [sec] title prefix", () => {
      const result = classifySecurityPR({
        title: "[sec] harden env var interpolation",
        labels: [],
        body: "Adds allowlist for interpolation.",
      });
      expect(result.isSecurityPR).toBe(true);
    });

    it("detects fix(security) conventional commit prefix", () => {
      const result = classifySecurityPR({
        title: "fix(security): escape context closing tag",
        labels: [],
        body: "Prevents prompt injection.",
      });
      expect(result.isSecurityPR).toBe(true);
    });

    it("detects security: prefix", () => {
      const result = classifySecurityPR({
        title: "security: tighten active PR detection",
        labels: [],
        body: "",
      });
      expect(result.isSecurityPR).toBe(true);
    });

    it("detects security label", () => {
      const result = classifySecurityPR({
        title: "chore: bump dependencies",
        labels: ["security"],
        body: "Routine dependency update.",
      });
      expect(result.isSecurityPR).toBe(true);
      expect(result.reason).toContain("security");
    });

    it("detects vulnerability label", () => {
      const result = classifySecurityPR({
        title: "chore: bump ai-sdk",
        labels: ["vulnerability"],
        body: "Fixes a known vulnerability in the upstream package.",
      });
      expect(result.isSecurityPR).toBe(true);
    });

    it("detects cve label", () => {
      const result = classifySecurityPR({
        title: "fix: update zod to address advisory",
        labels: ["cve"],
        body: "CVE-2025-12345 remediation.",
      });
      expect(result.isSecurityPR).toBe(true);
    });

    it("detects security-fix label", () => {
      const result = classifySecurityPR({
        title: "fix: sanitise clipboard output",
        labels: ["security-fix"],
        body: "Strips control characters before clipboard write.",
      });
      expect(result.isSecurityPR).toBe(true);
    });

    it("is case-insensitive for title prefix", () => {
      const result = classifySecurityPR({
        title: "[SECURITY] update ALLOWED_INTERPOLATION_VARS",
        labels: [],
        body: "",
      });
      expect(result.isSecurityPR).toBe(true);
    });

    it("is case-insensitive for labels", () => {
      const result = classifySecurityPR({
        title: "chore: tidy up tests",
        labels: ["Security"],
        body: "",
      });
      expect(result.isSecurityPR).toBe(true);
    });

    it("triggers on title prefix even when body is empty", () => {
      const result = classifySecurityPR({
        title: "sec: enforce strict mode",
        labels: [],
        body: "",
      });
      expect(result.isSecurityPR).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // FALSE POSITIVES — PRs that must NOT be classified as security
  // ──────────────────────────────────────────────
  describe("false positives (boilerplate-only body)", () => {
    it("does NOT classify a PR with 'Advanced Security' in body only", () => {
      const result = classifySecurityPR({
        title: "chore(deps): bump actions/checkout",
        labels: ["dependencies"],
        body: [
          "Bumps actions/checkout from 3 to 4.",
          "",
          "> Note: This repository uses GitHub Advanced Security.",
          "> Automated by [Security Daily](https://example.com)",
        ].join("\n"),
      });
      expect(result.isSecurityPR).toBe(false);
    });

    it("does NOT classify a deps update PR with generic security mention in body", () => {
      const result = classifySecurityPR({
        title: "chore: update all dependencies",
        labels: ["dependencies", "automated"],
        body: [
          "Automated dependency update.",
          "",
          "No security issues found in this update.",
        ].join("\n"),
      });
      expect(result.isSecurityPR).toBe(false);
    });

    it("does NOT classify a maintenance PR with 'security' in description prose", () => {
      const result = classifySecurityPR({
        title: "chore: update biome to 2.4.5",
        labels: [],
        body: [
          "Updates biome linter.",
          "This tool helps maintain code security standards.",
          "No functional changes.",
        ].join("\n"),
      });
      expect(result.isSecurityPR).toBe(false);
    });

    it("does NOT classify a PR whose body contains only a security-keyword boilerplate footer", () => {
      // Regression for: dependency-update PRs whose auto-generated footer
      // contains "GitHub Advanced Security" or "Automated by Security Daily"
      // — both match generic security keyword checks but are not security fixes.
      // See: [security][automation] Harden active security PR detection issue.
      const result = classifySecurityPR({
        title: "deps: automated dependency update",
        labels: ["automated"],
        body: [
          "## Changes",
          "- Updated 12 packages.",
          "",
          "---",
          "> Automated by [Security Daily](https://github.com/hongymagic/q/actions/runs/1234)",
          "> This repository uses GitHub Advanced Security scanning.",
        ].join("\n"),
      });
      expect(result.isSecurityPR).toBe(false);
    });

    it("does NOT classify a feature PR with 'CVE' mentioned in a historical context", () => {
      const result = classifySecurityPR({
        title: "feat: add bedrock provider",
        labels: ["enhancement"],
        body: [
          "Adds AWS Bedrock as a provider option.",
          "Tested against models not affected by CVE-2024-00000.",
        ].join("\n"),
      });
      expect(result.isSecurityPR).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // MIXED CASES — strong signal present despite noisy body
  // ──────────────────────────────────────────────
  describe("mixed cases", () => {
    it("classifies as security when label present even if body is boilerplate-heavy", () => {
      const result = classifySecurityPR({
        title: "chore: dependency update",
        labels: ["security", "dependencies"],
        body: [
          "Automated update triggered by Advanced Security advisory.",
          "> Automated by Security Daily",
        ].join("\n"),
      });
      expect(result.isSecurityPR).toBe(true);
      expect(result.reason).toContain("security");
    });

    it("classifies as security when title prefix present even if labels are generic", () => {
      const result = classifySecurityPR({
        title: "[security] patch CVE-2025-99999 in zod schema parsing",
        labels: ["bug", "automated"],
        body: [
          "Patches a critical parsing issue.",
          "> This repository uses GitHub Advanced Security.",
        ].join("\n"),
      });
      expect(result.isSecurityPR).toBe(true);
    });

    it("is false when neither strong signal is present despite many body keywords", () => {
      const result = classifySecurityPR({
        title: "chore: tidy up README",
        labels: ["documentation"],
        body: [
          "Improves security section of README.",
          "Mentions CVE handling, vulnerability disclosure, credential rotation.",
          "No code changes.",
        ].join("\n"),
      });
      expect(result.isSecurityPR).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // stripBoilerplate utility
  // ──────────────────────────────────────────────
  describe("stripBoilerplate", () => {
    it("removes HTML comment blocks", () => {
      const input =
        "Real content\n<!-- auto-generated: GitHub Advanced Security -->\nMore real content";
      const result = stripBoilerplate(input);
      expect(result).not.toContain("Advanced Security");
      expect(result).toContain("Real content");
      expect(result).toContain("More real content");
    });

    it("removes blockquote footer lines matching boilerplate patterns", () => {
      const input = [
        "PR description here.",
        "> Automated by [Security Daily](https://example.com)",
        "> This uses GitHub Advanced Security.",
      ].join("\n");
      const result = stripBoilerplate(input);
      expect(result).toContain("PR description here.");
      expect(result).not.toContain("Advanced Security");
      expect(result).not.toContain("Security Daily");
    });

    it("preserves non-boilerplate blockquote lines", () => {
      const input = [
        "Summary",
        "> Note: This PR depends on #42 being merged first.",
      ].join("\n");
      const result = stripBoilerplate(input);
      expect(result).toContain("> Note: This PR depends on #42");
    });

    it("returns original content when no boilerplate present", () => {
      const input = "Just a regular PR body with no footer noise.";
      const result = stripBoilerplate(input);
      expect(result).toBe(input);
    });
  });

  // ──────────────────────────────────────────────
  // Constant completeness checks
  // ──────────────────────────────────────────────
  describe("constants", () => {
    it("SECURITY_TITLE_PREFIXES contains expected values", () => {
      expect(SECURITY_TITLE_PREFIXES).toContain("[security]");
      expect(SECURITY_TITLE_PREFIXES).toContain("[sec]");
      expect(SECURITY_TITLE_PREFIXES).toContain("fix(security)");
      expect(SECURITY_TITLE_PREFIXES).toContain("security:");
    });

    it("SECURITY_LABELS contains expected values", () => {
      expect(SECURITY_LABELS).toContain("security");
      expect(SECURITY_LABELS).toContain("vulnerability");
      expect(SECURITY_LABELS).toContain("cve");
    });

    it("BOILERPLATE_PATTERNS matches GitHub Advanced Security text", () => {
      const text = "> This repository uses GitHub Advanced Security";
      expect(BOILERPLATE_PATTERNS.some((p) => p.test(text))).toBe(true);
    });

    it("BOILERPLATE_PATTERNS matches automation footer text", () => {
      const text =
        "> Automated by [Security Daily](https://github.com/example/run)";
      expect(BOILERPLATE_PATTERNS.some((p) => p.test(text))).toBe(true);
    });

    it("BOILERPLATE_PATTERNS does NOT match normal security discussion", () => {
      const text = "This fix addresses a critical auth bypass.";
      // Only automation boilerplate should match, not general security prose
      const matched = BOILERPLATE_PATTERNS.filter((p) => p.test(text));
      // dependabot / advanced security patterns should not fire here
      expect(matched).toHaveLength(0);
    });
  });
});
