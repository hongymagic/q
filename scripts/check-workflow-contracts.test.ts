import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasAddCommentSafeOutput,
  hasExplicitItemNumber,
  hasPlanningGate,
  hasPlanSummaryRequirement,
  parseWorkflowFile,
  validateAllWorkflows,
  validateWorkflowContract,
} from "./check-workflow-contracts.ts";

describe("check-workflow-contracts", () => {
  describe("parseWorkflowFile", () => {
    it("splits frontmatter and body", () => {
      const content = "---\nname: Test\n---\n\n# Body";
      const result = parseWorkflowFile(content);
      expect(result.frontmatter).toBe("name: Test");
      expect(result.body).toBe("\n# Body");
    });

    it("returns empty frontmatter when no delimiters", () => {
      const content = "# Just a body";
      const result = parseWorkflowFile(content);
      expect(result.frontmatter).toBe("");
      expect(result.body).toBe("# Just a body");
    });
  });

  describe("hasPlanningGate", () => {
    it("detects Planning Gate heading", () => {
      expect(hasPlanningGate("## Planning Gate (required)\n")).toBe(true);
      expect(hasPlanningGate("## Planning Gate\n")).toBe(true);
    });

    it("rejects missing heading", () => {
      expect(hasPlanningGate("## Goal\nDo stuff.")).toBe(false);
    });
  });

  describe("hasPlanSummaryRequirement", () => {
    it("detects 'first visible output' pattern", () => {
      expect(
        hasPlanSummaryRequirement(
          "Include a concise summary of your plan in the first visible output.",
        ),
      ).toBe(true);
    });

    it("detects 'surfaced in output' pattern", () => {
      expect(
        hasPlanSummaryRequirement("plan is complete and surfaced in output"),
      ).toBe(true);
    });

    it("rejects content without plan-summary requirement", () => {
      expect(hasPlanSummaryRequirement("Just do stuff.")).toBe(false);
    });
  });

  describe("hasAddCommentSafeOutput", () => {
    it("detects add-comment in frontmatter", () => {
      expect(hasAddCommentSafeOutput("  add-comment:\n    max: 1")).toBe(true);
    });

    it("rejects frontmatter without add-comment", () => {
      expect(hasAddCommentSafeOutput("  create-issue:\n    max: 1")).toBe(
        false,
      );
    });
  });

  describe("hasExplicitItemNumber", () => {
    it("detects add_comment(item_number=...)", () => {
      expect(
        hasExplicitItemNumber(
          "call `add_comment(item_number=<issue-number>, body=...)`",
        ),
      ).toBe(true);
    });

    it("rejects add_comment without item_number", () => {
      expect(hasExplicitItemNumber("call `add_comment` with the summary")).toBe(
        false,
      );
    });
  });

  describe("validateWorkflowContract", () => {
    const validContent = [
      "---",
      "safe-outputs:",
      "  add-comment:",
      "    max: 1",
      "---",
      "",
      "## Planning Gate (required)",
      "",
      "Do not act until plan is complete and included in your first visible output.",
      "",
      "Use `add_comment(item_number=<issue-number>, body=...)`.",
    ].join("\n");

    it("returns no errors for a valid workflow", () => {
      const result = validateWorkflowContract("valid.md", validContent);
      expect(result.errors).toEqual([]);
    });

    it("reports missing Planning Gate", () => {
      const content = validContent.replace(
        "## Planning Gate (required)",
        "## Goal",
      );
      const result = validateWorkflowContract("test.md", content);
      expect(result.errors).toContainEqual(
        expect.stringContaining("Planning Gate"),
      );
    });

    it("reports missing plan-summary requirement", () => {
      const content = validContent.replace(
        "included in your first visible output",
        "go ahead and do it",
      );
      const result = validateWorkflowContract("test.md", content);
      expect(result.errors).toContainEqual(
        expect.stringContaining("plan-summary"),
      );
    });

    it("reports missing item_number when add-comment is present", () => {
      const content = validContent.replace(
        "add_comment(item_number=<issue-number>, body=...)",
        "add_comment with the summary",
      );
      const result = validateWorkflowContract("test.md", content);
      expect(result.errors).toContainEqual(
        expect.stringContaining("add_comment(item_number="),
      );
    });

    it("allows missing item_number when no add-comment safe output", () => {
      const content = [
        "---",
        "safe-outputs:",
        "  create-issue:",
        "    max: 1",
        "---",
        "",
        "## Planning Gate (required)",
        "",
        "Plan included in your first visible output.",
      ].join("\n");
      const result = validateWorkflowContract("test.md", content);
      expect(result.errors).toEqual([]);
    });
  });

  describe("validateAllWorkflows (integration)", () => {
    it("all workflow markdown files pass contract checks", () => {
      const dirname = import.meta.dirname ?? ".";
      const workflowDir = join(dirname, "..", ".github", "workflows");
      const results = validateAllWorkflows(workflowDir);

      const allErrors = results.flatMap((r) => r.errors);
      if (allErrors.length > 0) {
        throw new Error(
          `Workflow contract violations:\n${allErrors.join("\n")}`,
        );
      }
      expect(allErrors).toEqual([]);
    });
  });
});
