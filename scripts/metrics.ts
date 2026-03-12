import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const ROOT = join(import.meta.dirname, "..");
const BASELINE_PATH = join(ROOT, "metrics", "baseline.json");

interface Metrics {
  timestamp: string;
  coverage_percent: number;
  test_total: number;
  test_passed: number;
  test_failed: number;
  binary_size_bytes: number;
  bundle_size_bytes: number;
  source_loc: number;
  test_loc: number;
  test_to_source_ratio: number;
  lint_errors: number;
  lint_warnings: number;
  dependency_count: number;
  dev_dependency_count: number;
}

interface Baseline {
  recorded_at: string;
  metrics: Metrics;
  thresholds: {
    coverage_drop_max_percent: number;
    binary_size_grow_max_percent: number;
    lint_errors_max: number;
  };
}

async function countLines(glob: string): Promise<number> {
  const result =
    await $`find ${ROOT} -path '${glob}' -name '*.ts' ! -path '*/node_modules/*' ! -path '*/dist/*' | xargs wc -l 2>/dev/null | tail -1`.text();
  const match = result.trim().match(/^(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : 0;
}

async function collectCoverage(): Promise<{
  percent: number;
  total: number;
  passed: number;
  failed: number;
}> {
  try {
    const result =
      await $`cd ${ROOT} && bun run vitest run --coverage --reporter=json 2>/dev/null`.text();
    const jsonStart = result.indexOf("{");
    if (jsonStart === -1) return { percent: 0, total: 0, passed: 0, failed: 0 };
    const json = JSON.parse(result.slice(jsonStart));
    const total = json.numTotalTests ?? 0;
    const passed = json.numPassedTests ?? 0;
    const failed = json.numFailedTests ?? 0;
    // Coverage percent from summary line
    const coverageResult =
      await $`cd ${ROOT} && bun run vitest run --coverage 2>&1 | grep 'All files'`.text();
    const coverageMatch = coverageResult.match(/\|\s*([\d.]+)\s*\|/);
    const percent = coverageMatch?.[1] ? parseFloat(coverageMatch[1]) : 0;
    return { percent, total, passed, failed };
  } catch {
    // Fallback: run tests separately
    try {
      const testResult =
        await $`cd ${ROOT} && bun run vitest run --reporter=json 2>/dev/null`.text();
      const jsonStart = testResult.indexOf("{");
      if (jsonStart >= 0) {
        const json = JSON.parse(testResult.slice(jsonStart));
        return {
          percent: 0,
          total: json.numTotalTests ?? 0,
          passed: json.numPassedTests ?? 0,
          failed: json.numFailedTests ?? 0,
        };
      }
    } catch {
      /* ignore */
    }
    return { percent: 0, total: 0, passed: 0, failed: 0 };
  }
}

async function collectLintViolations(): Promise<{
  errors: number;
  warnings: number;
}> {
  try {
    const result =
      await $`cd ${ROOT} && bunx biome check . --reporter=json 2>/dev/null`.text();
    const json = JSON.parse(result);
    const diagnostics = json.diagnostics ?? [];
    let errors = 0;
    let warnings = 0;
    for (const d of diagnostics) {
      if (d.severity === "error") errors++;
      else warnings++;
    }
    return { errors, warnings };
  } catch {
    return { errors: 0, warnings: 0 };
  }
}

async function buildAndMeasure(): Promise<{
  binarySize: number;
  bundleSize: number;
}> {
  let binarySize = 0;
  let bundleSize = 0;

  try {
    await $`cd ${ROOT} && bun build --compile --minify --sourcemap ./src/cli.ts --outfile dist/q 2>/dev/null`.quiet();
    const stat = statSync(join(ROOT, "dist", "q"));
    binarySize = stat.size;
  } catch {
    /* build may fail in CI without target platform */
  }

  try {
    await $`cd ${ROOT} && bun build ./src/cli.ts --outfile dist/q.js --target node 2>/dev/null`.quiet();
    const stat = statSync(join(ROOT, "dist", "q.js"));
    bundleSize = stat.size;
  } catch {
    /* ignore */
  }

  return { binarySize, bundleSize };
}

async function collectMetrics(): Promise<Metrics> {
  const [coverage, lint, sizes, sourceLoc, testLoc, pkg] = await Promise.all([
    collectCoverage(),
    collectLintViolations(),
    buildAndMeasure(),
    countLines(`${ROOT}/src`),
    countLines(`${ROOT}/tests`),
    Bun.file(join(ROOT, "package.json")).json(),
  ]);

  const depCount = Object.keys(pkg.dependencies ?? {}).length;
  const devDepCount = Object.keys(pkg.devDependencies ?? {}).length;

  return {
    timestamp: new Date().toISOString(),
    coverage_percent: coverage.percent,
    test_total: coverage.total,
    test_passed: coverage.passed,
    test_failed: coverage.failed,
    binary_size_bytes: sizes.binarySize,
    bundle_size_bytes: sizes.bundleSize,
    source_loc: sourceLoc,
    test_loc: testLoc,
    test_to_source_ratio:
      sourceLoc > 0 ? Math.round((testLoc / sourceLoc) * 100) / 100 : 0,
    lint_errors: lint.errors,
    lint_warnings: lint.warnings,
    dependency_count: depCount,
    dev_dependency_count: devDepCount,
  };
}

function compareToBaseline(current: Metrics, baseline: Baseline): string[] {
  const regressions: string[] = [];
  const { thresholds, metrics: prev } = baseline;

  if (prev.coverage_percent > 0 && current.coverage_percent > 0) {
    const drop = prev.coverage_percent - current.coverage_percent;
    if (drop > thresholds.coverage_drop_max_percent) {
      regressions.push(
        `Coverage dropped by ${drop.toFixed(1)}% (${prev.coverage_percent}% -> ${current.coverage_percent}%), threshold: ${thresholds.coverage_drop_max_percent}%`,
      );
    }
  }

  if (prev.binary_size_bytes > 0 && current.binary_size_bytes > 0) {
    const growth =
      ((current.binary_size_bytes - prev.binary_size_bytes) /
        prev.binary_size_bytes) *
      100;
    if (growth > thresholds.binary_size_grow_max_percent) {
      regressions.push(
        `Binary size grew by ${growth.toFixed(1)}% (${prev.binary_size_bytes} -> ${current.binary_size_bytes} bytes), threshold: ${thresholds.binary_size_grow_max_percent}%`,
      );
    }
  }

  if (current.lint_errors > thresholds.lint_errors_max) {
    regressions.push(
      `Lint errors: ${current.lint_errors}, threshold: ${thresholds.lint_errors_max}`,
    );
  }

  if (current.test_failed > 0) {
    regressions.push(`${current.test_failed} test(s) failing`);
  }

  return regressions;
}

async function main() {
  const args = process.argv.slice(2);
  const updateBaseline = args.includes("--update-baseline");
  const checkOnly = args.includes("--check");

  console.error("Collecting metrics...");
  const metrics = await collectMetrics();

  if (checkOnly && existsSync(BASELINE_PATH)) {
    const baseline: Baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
    const regressions = compareToBaseline(metrics, baseline);

    console.log(JSON.stringify({ metrics, regressions }, null, 2));

    if (regressions.length > 0) {
      console.error("\nRegressions detected:");
      for (const r of regressions) {
        console.error(`  - ${r}`);
      }
      process.exit(1);
    }

    console.error("\nNo regressions detected.");
    return;
  }

  if (updateBaseline) {
    const baseline: Baseline = {
      recorded_at: metrics.timestamp,
      metrics,
      thresholds: {
        coverage_drop_max_percent: 2,
        binary_size_grow_max_percent: 10,
        lint_errors_max: 0,
      },
    };
    await Bun.write(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
    console.error(`Baseline updated at ${BASELINE_PATH}`);
    return;
  }

  console.log(JSON.stringify(metrics, null, 2));
}

main();
