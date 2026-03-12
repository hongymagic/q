import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

interface BenchmarkResult {
  name: string;
  value: number;
  unit: string;
  samples?: number;
}

interface BenchmarkReport {
  timestamp: string;
  results: BenchmarkResult[];
}

async function measureStartupTime(runs = 10): Promise<BenchmarkResult> {
  const times: number[] = [];
  const cliPath = join(ROOT, "src", "cli.ts");

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const proc = Bun.spawn(["bun", "run", cliPath, "--help"], {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "pipe",
    });
    // Pipe empty stdin to avoid blocking
    proc.stdin.end();
    await proc.exited;
    const elapsed = performance.now() - start;
    times.push(elapsed);
  }

  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)] ?? 0;

  return {
    name: "startup_time_ms",
    value: Math.round(median * 100) / 100,
    unit: "ms",
    samples: runs,
  };
}

async function measureBinarySize(): Promise<BenchmarkResult> {
  const binaryPath = join(ROOT, "dist", "q");

  if (!existsSync(binaryPath)) {
    // Build if not present
    const proc = Bun.spawn(
      [
        "bun",
        "build",
        "--compile",
        "--minify",
        "--sourcemap",
        "./src/cli.ts",
        "--outfile",
        "dist/q",
      ],
      { cwd: ROOT, stdout: "pipe", stderr: "pipe" },
    );
    await proc.exited;
  }

  const size = existsSync(binaryPath) ? statSync(binaryPath).size : 0;

  return {
    name: "binary_size_bytes",
    value: size,
    unit: "bytes",
  };
}

async function measureBundleSize(): Promise<BenchmarkResult> {
  const bundlePath = join(ROOT, "dist", "q.js");

  if (!existsSync(bundlePath)) {
    const proc = Bun.spawn(
      [
        "bun",
        "build",
        "./src/cli.ts",
        "--outfile",
        "dist/q.js",
        "--target",
        "node",
      ],
      { cwd: ROOT, stdout: "pipe", stderr: "pipe" },
    );
    await proc.exited;
  }

  const size = existsSync(bundlePath) ? statSync(bundlePath).size : 0;

  return {
    name: "bundle_size_bytes",
    value: size,
    unit: "bytes",
  };
}

async function measureConfigParse(runs = 100): Promise<BenchmarkResult> {
  const times: number[] = [];

  // Dynamic import to measure actual parse time
  const { Config } = await import("../src/config/index.ts");

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    try {
      Config.load();
    } catch {
      // Config may fail without a valid config file, that's fine for timing
    }
    const elapsed = performance.now() - start;
    times.push(elapsed);
  }

  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)] ?? 0;

  return {
    name: "config_parse_ms",
    value: Math.round(median * 1000) / 1000,
    unit: "ms",
    samples: runs,
  };
}

async function main() {
  console.error("Running benchmarks...");

  const results = await Promise.all([
    measureStartupTime(),
    measureBinarySize(),
    measureBundleSize(),
    measureConfigParse(),
  ]);

  const report: BenchmarkReport = {
    timestamp: new Date().toISOString(),
    results,
  };

  console.log(JSON.stringify(report, null, 2));

  // Print summary to stderr
  console.error("\nBenchmark Results:");
  for (const r of results) {
    const samples = r.samples ? ` (${r.samples} samples)` : "";
    console.error(`  ${r.name}: ${r.value} ${r.unit}${samples}`);
  }
}

main();
