import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

function runCli(args: string): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  try {
    const stdout = execSync(`echo "" | bun run src/cli.ts ${args}`, {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 10_000,
      env: {
        ...process.env,
        Q_PROVIDER: undefined,
        Q_MODEL: undefined,
        Q_COPY: undefined,
      },
    });
    return { stdout: stdout.trim(), stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const e = err as {
      stdout?: string;
      stderr?: string;
      status?: number;
    };
    return {
      stdout: (e.stdout ?? "").trim(),
      stderr: (e.stderr ?? "").trim(),
      exitCode: e.status ?? 1,
    };
  }
}

describe("CLI integration", () => {
  it("prints version with --version", () => {
    const { stdout, exitCode } = runCli("--version");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("prints version with -v", () => {
    const { stdout, exitCode } = runCli("-v");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("prints help with --help", () => {
    const { stdout, exitCode } = runCli("--help");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("q - Quick AI answers");
    expect(stdout).toContain("--provider");
  });

  it("prints help when no args", () => {
    const { stdout, exitCode } = runCli("");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("q - Quick AI answers");
  });

  it("prints config path", () => {
    const { stdout, exitCode } = runCli("config path");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("config.toml");
  });

  it("rejects unknown config subcommands", () => {
    const { exitCode } = runCli("config unknown");
    expect(exitCode).not.toBe(0);
  });
});
