import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ValidationResult {
  file: string;
  errors: string[];
}

export function parseWorkflowFile(content: string): {
  frontmatter: string;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: "", body: content };
  return { frontmatter: match[1] ?? "", body: match[2] ?? "" };
}

export function hasAddCommentSafeOutput(frontmatter: string): boolean {
  return /add-comment:/.test(frontmatter);
}

export function hasPlanningGate(body: string): boolean {
  return /^##\s+Planning Gate/im.test(body);
}

export function hasPlanSummaryRequirement(body: string): boolean {
  // Matches: "plan...visible output", "plan...first...output", or "surfaced in output"
  const planVisibleOutput = /plan.+(?:visible|first).+output/im;
  const surfacedInOutput = /surfaced in output/im;
  return planVisibleOutput.test(body) || surfacedInOutput.test(body);
}

export function hasExplicitItemNumber(body: string): boolean {
  return /add_comment\(item_number=/i.test(body);
}

export function validateWorkflowContract(
  file: string,
  content: string,
): ValidationResult {
  const { frontmatter, body } = parseWorkflowFile(content);
  const errors: string[] = [];

  if (!hasPlanningGate(body)) {
    errors.push(`${file}: missing "## Planning Gate" section in prompt body`);
  }

  if (!hasPlanSummaryRequirement(body)) {
    errors.push(
      `${file}: missing plan-summary visible output requirement in prompt body`,
    );
  }

  if (hasAddCommentSafeOutput(frontmatter) && !hasExplicitItemNumber(body)) {
    errors.push(
      `${file}: has add-comment safe output but missing explicit add_comment(item_number=...) in prompt body`,
    );
  }

  return { file, errors };
}

export function validateAllWorkflows(workflowDir: string): ValidationResult[] {
  const files = readdirSync(workflowDir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("README"),
  );

  return files.map((file) => {
    const content = readFileSync(join(workflowDir, file), "utf-8");
    return validateWorkflowContract(file, content);
  });
}
