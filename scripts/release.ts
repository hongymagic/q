#!/usr/bin/env bun

/**
 * CalVer release script
 *
 * Creates and pushes a CalVer tag in the format: vYYYY.MMDD.PATCH
 *
 * Usage:
 *   bun run scripts/release.ts           # Interactive release
 *   bun run scripts/release.ts --dry-run # Preview only
 *   bun run scripts/release.ts --yes     # Skip confirmation
 */

import { $ } from "bun";
import { findLatestTag, getNextPatch, getTodayCalVer } from "./calver.ts";

interface ReleaseOptions {
  dryRun: boolean;
  skipConfirm: boolean;
}

/**
 * Find the latest tag for a given CalVer date prefix
 */
async function getLatestTagForDate(datePrefix: string): Promise<string | null> {
  const pattern = `v${datePrefix}.*`;
  const result = await $`git tag -l ${pattern}`.nothrow().quiet().text();
  const tags = result.split("\n");
  return findLatestTag(tags);
}

/**
 * Prompt user for confirmation
 */
async function confirm(message: string): Promise<boolean> {
  process.stdout.write(`${message} [y/N] `);
  for await (const line of console) {
    return line.toLowerCase() === "y";
  }
  return false;
}

/**
 * Parse command line arguments
 */
function parseArgs(argv: string[]): ReleaseOptions {
  return {
    dryRun: argv.includes("--dry-run") || argv.includes("-n"),
    skipConfirm: argv.includes("--yes") || argv.includes("-y"),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  // Fetch latest tags from remote (ignore errors from tag conflicts)
  console.log("Fetching tags...");
  await $`git fetch --tags`.nothrow().quiet();

  const datePrefix = getTodayCalVer();
  const latestTag = await getLatestTagForDate(datePrefix);
  const nextPatch = getNextPatch(latestTag);
  const newTag = `v${datePrefix}.${nextPatch}`;

  console.log(`\nCalVer Release`);
  console.log(`──────────────`);
  console.log(`Today's prefix:  ${datePrefix}`);
  console.log(`Latest tag:      ${latestTag ?? "none"}`);
  console.log(`New tag:         ${newTag}`);

  if (options.dryRun) {
    console.log(`\n(dry run — no tag created)`);
    return;
  }

  if (!options.skipConfirm) {
    const confirmed = await confirm(`\nCreate and push ${newTag}?`);
    if (!confirmed) {
      console.log("Aborted.");
      process.exit(1);
    }
  }

  // Create and push the tag
  console.log(`\nCreating tag ${newTag}...`);
  await $`git tag ${newTag}`;

  console.log(`Pushing tag to origin...`);
  await $`git push origin ${newTag}`;

  console.log(`\n✓ Tag ${newTag} pushed successfully!`);
  console.log(`\nRelease workflow will start shortly.`);
  console.log(`View progress: https://github.com/hongymagic/q/actions`);
}

// Run main function
main().catch((err) => {
  console.error("\nRelease failed:", err.message);
  process.exit(1);
});
