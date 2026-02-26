/**
 * CalVer utilities - pure functions for calendar versioning
 *
 * These functions have no side effects and can be used in both
 * the release script and tests.
 */

/** Regex to parse CalVer tags: vYYYY.MMDD.PATCH */
export const CALVER_TAG_REGEX = /^v(\d{4})\.(\d{4})\.(\d+)$/;

/**
 * Get today's date as a CalVer prefix (YYYY.MMDD)
 */
export function getTodayCalVer(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}.${month}${day}`;
}

/**
 * Parse a CalVer tag and extract its components
 */
export function parseCalVerTag(
  tag: string,
): { year: number; monthDay: string; patch: number } | null {
  const match = tag.match(CALVER_TAG_REGEX);
  if (!match || !match[1] || !match[2] || !match[3]) return null;
  return {
    year: parseInt(match[1], 10),
    monthDay: match[2],
    patch: parseInt(match[3], 10),
  };
}

/**
 * Get the next patch number based on the latest tag
 */
export function getNextPatch(latestTag: string | null): number {
  if (!latestTag) return 0;
  const parsed = parseCalVerTag(latestTag);
  if (!parsed) return 0;
  return parsed.patch + 1;
}

/**
 * Filter and sort CalVer tags, returning the latest stable tag
 */
export function findLatestTag(tags: string[]): string | null {
  const stableTags = tags
    .map((t) => t.trim())
    .filter((t) => t && !t.includes("-")) // Exclude pre-release tags
    .sort((a, b) => {
      const patchA = parseCalVerTag(a)?.patch ?? 0;
      const patchB = parseCalVerTag(b)?.patch ?? 0;
      return patchA - patchB;
    });

  return stableTags.at(-1) ?? null;
}

/**
 * Generate a CalVer pre-release version string
 */
export function generatePreReleaseVersion(
  datePrefix: string,
  patch: number,
  shortSha: string,
): string {
  return `${datePrefix}.${patch}-next.${shortSha}`;
}
