import { execSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

function runCli(
  args: string,
  envOverrides: Record<string, string | undefined> = {},
): {
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
        NO_COLOR: "1",
        ...envOverrides,
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

function createIsolatedEnv(): {
  rootDir: string;
  env: {
    HOME: string;
    XDG_CONFIG_HOME: string;
    XDG_STATE_HOME: string;
    NO_COLOR: string;
  };
} {
  const rootDir = mkdtempSync(resolve(tmpdir(), "q-cli-"));
  const homeDir = resolve(rootDir, "home");
  const configDir = resolve(rootDir, "config");
  const stateDir = resolve(rootDir, "state");

  mkdirSync(homeDir, { recursive: true });
  mkdirSync(configDir, { recursive: true });
  mkdirSync(stateDir, { recursive: true });

  return {
    rootDir,
    env: {
      HOME: homeDir,
      XDG_CONFIG_HOME: configDir,
      XDG_STATE_HOME: stateDir,
      NO_COLOR: "1",
    },
  };
}

function writeConfig(env: { XDG_CONFIG_HOME: string }, contents: string): void {
  const configPath = resolve(env.XDG_CONFIG_HOME, "q", "config.toml");
  mkdirSync(resolve(env.XDG_CONFIG_HOME, "q"), { recursive: true });
  writeFileSync(configPath, contents, "utf8");
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
    const { stderr, exitCode } = runCli("config unknown");
    expect(exitCode).not.toBe(0);
    expect(stderr).not.toContain("Full log:");
  });

  it("prints concise config errors and writes a failure log", () => {
    const { rootDir, env } = createIsolatedEnv();

    try {
      const { stderr, exitCode } = runCli("hello", env);

      expect(exitCode).toBe(2);
      expect(stderr).toContain(
        "Error: Config file not found. Run 'q config init'.",
      );
      expect(stderr).toContain("Full log: ");
      expect(stderr).not.toContain("Error: Config file not found:");

      const match = stderr.match(/^Full log: (.+)$/m);
      expect(match?.[1]).toBeTruthy();

      const logPath = match?.[1];
      expect(logPath).toContain(resolve(env.XDG_STATE_HOME, "q", "errors"));

      const logContent = readFileSync(logPath as string, "utf8");
      expect(logContent).toContain(
        "Display message:\nConfig file not found. Run 'q config init'.",
      );
      expect(logContent).toContain("Config file not found:");
      expect(logContent).toContain("Session context:");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("keeps debug diagnostics on stderr and still writes a failure log", () => {
    const { rootDir, env } = createIsolatedEnv();

    try {
      const { stderr, exitCode } = runCli("--debug hello", env);

      expect(exitCode).toBe(2);
      expect(stderr).toContain("[debug] Mode:");
      expect(stderr).toContain("[debug] Loading config...");
      expect(stderr).toContain(
        "Error: Config file not found. Run 'q config init'.",
      );
      expect(stderr).toContain("name: ConfigNotFoundError");
      expect(stderr).toContain("Full log: ");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("shows concise provider failures instead of raw SDK errors", () => {
    const { rootDir, env } = createIsolatedEnv();

    try {
      writeConfig(
        env,
        [
          "[default]",
          'provider = "local"',
          'model = "test-model"',
          "",
          "[providers.local]",
          'type = "ollama"',
          'base_url = "http://127.0.0.1:1/api"',
          "",
        ].join("\n"),
      );

      const { stderr, exitCode } = runCli("hello", env);

      expect(exitCode).toBe(1);
      expect(stderr).toContain(
        "Error: AI request failed: could not connect to provider (connection refused).",
      );
      expect(stderr).toContain("Full log: ");
      expect(stderr).not.toContain("AI_RetryError");
      expect(stderr).not.toContain("AI_APICallError");
      expect(stderr).not.toContain("ConnectionRefused");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  }, 15_000);
});
