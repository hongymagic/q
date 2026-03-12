import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

describe("benchmarks", () => {
  it("startup with --help completes within 5 seconds", () => {
    const cliPath = join(ROOT, "src", "cli.ts");
    const start = performance.now();
    execFileSync("bun", ["run", cliPath, "--help"], {
      stdio: "pipe",
      input: "",
      timeout: 5000,
    });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5000);
  });

  it("npm bundle builds successfully", () => {
    execFileSync(
      "bun",
      ["build", "./src/cli.ts", "--outfile", "dist/q.js", "--target", "node"],
      { cwd: ROOT, stdio: "pipe", timeout: 30000 },
    );

    const bundlePath = join(ROOT, "dist", "q.js");
    expect(existsSync(bundlePath)).toBe(true);

    const size = statSync(bundlePath).size;
    // Bundle should be under 5MB
    expect(size).toBeLessThan(5 * 1024 * 1024);
  });

  it("config module imports without errors", async () => {
    const start = performance.now();
    const { Config } = await import("../src/config/index.ts");
    const elapsed = performance.now() - start;

    expect(Config).toBeDefined();
    expect(Config.load).toBeTypeOf("function");
    // Module import should be fast
    expect(elapsed).toBeLessThan(2000);
  });
});
