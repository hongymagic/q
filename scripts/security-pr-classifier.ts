/**
 * Deterministic security PR classification for the security-daily orchestrator.
 *
 * An active security PR must satisfy at least one STRONG positive indicator.
 * Body-only keyword matches are weak and insufficient on their own.
 */

/**
 * Minimal PR shape required for classification.
 *
 * - `title`: the PR title string
 * - `labels`: flat list of label name strings (not label objects)
 * - `body`: the PR description in markdown; may contain HTML comments
 *   and blockquote footer sections added by automation
 */
export interface PullRequestSignals {
  title: string;
  labels: string[];
  body: string;
}

/** Result returned by the classifier. */
export interface ClassificationResult {
  isSecurityPR: boolean;
  reason: string;
}

/**
 * Title prefixes that unambiguously identify a security-focused PR.
 * The comparison is case-insensitive.
 */
export const SECURITY_TITLE_PREFIXES = [
  "[security]",
  "[sec]",
  "fix(security)",
  "fix(sec)",
  "feat(security)",
  "feat(sec)",
  "security:",
  "sec:",
];

/**
 * Labels that signal security work.
 * All comparisons are case-insensitive.
 */
export const SECURITY_LABELS = [
  "security",
  "vulnerability",
  "cve",
  "security-fix",
  "security-patch",
  "sec",
];

/**
 * Known boilerplate patterns that must NOT count as security signals.
 *
 * These patterns appear in auto-generated footer content or CI report
 * blocks that reference the GitHub Advanced Security product name,
 * not actual security remediation work.
 */
export const BOILERPLATE_PATTERNS = [
  /github advanced security/i,
  /advanced security/i,
  /dependabot/i,
  /automated by .*(security daily|security review)/i,
  /\[security\]\[automation\]/i,
];

/**
 * Strip boilerplate sections from a PR body before keyword scanning.
 *
 * This is an exported utility for testing and validation. The classifier
 * itself does NOT rely on this function — it deliberately skips body
 * keyword matching entirely rather than attempting to clean noisy content.
 *
 * Boilerplate removed:
 * - HTML comment blocks (`<!-- ... -->`)
 * - Blockquote lines (`>`) that match a known boilerplate pattern
 *
 * NOTE: This function is NOT an HTML sanitizer. The output is used only for
 * text-based classification — it is never rendered as HTML.
 */
export function stripBoilerplate(body: string): string {
  // Remove complete HTML comment blocks added by automation.
  // Split on the opening marker and reassemble, discarding everything
  // up to and including the closing marker in each segment.
  const withoutComments = body
    .split("<!--")
    .map((segment, i) => {
      if (i === 0) return segment; // content before the first <!--
      const closeIdx = segment.indexOf("-->");
      return closeIdx === -1 ? "" : segment.slice(closeIdx + 3);
    })
    .join("");

  // Remove blockquote footer lines matching boilerplate patterns
  const stripped = withoutComments
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith(">")) return true;
      return !BOILERPLATE_PATTERNS.some((pattern) => pattern.test(trimmed));
    })
    .join("\n");

  return stripped.trim();
}

/**
 * Classify a PR as active security work or not.
 *
 * Strong positive indicators (any one is sufficient):
 *   1. Title starts with a security-specific prefix.
 *   2. PR has a security-related label.
 *
 * Body keyword matching is intentionally excluded as a standalone signal
 * because boilerplate text (e.g., "GitHub Advanced Security") can
 * satisfy generic keyword checks in non-security PRs.
 *
 * @param pr - Minimal PR shape with title, labels and body.
 * @returns Classification result with reason.
 */
export function classifySecurityPR(
  pr: PullRequestSignals,
): ClassificationResult {
  const titleLower = pr.title.toLowerCase().trim();
  const labelsLower = pr.labels.map((l) => l.toLowerCase().trim());

  // Check title prefix (strong signal)
  for (const prefix of SECURITY_TITLE_PREFIXES) {
    if (titleLower.startsWith(prefix.toLowerCase())) {
      return {
        isSecurityPR: true,
        reason: `Title starts with security prefix "${prefix}"`,
      };
    }
  }

  // Check labels (strong signal)
  for (const label of labelsLower) {
    if (SECURITY_LABELS.includes(label)) {
      return {
        isSecurityPR: true,
        reason: `PR has security label "${label}"`,
      };
    }
  }

  // Body-only keyword check: deliberately excluded as a standalone signal.
  // Even after boilerplate stripping, a body match alone is too noisy.

  return {
    isSecurityPR: false,
    reason: "No strong security signal (title prefix or label) found",
  };
}
