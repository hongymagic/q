import { describe, expect, it } from "vitest";
import { getHelpText, getVersion, parseCliArgs } from "../src/args.ts";
import { UsageError } from "../src/errors.ts";

describe("CLI argument parsing", () => {
  describe("parseCliArgs", () => {
    it("should parse a simple query", () => {
      const args = parseCliArgs(["how", "do", "I", "restart", "docker"]);
      expect(args.command).toBe("query");
      expect(args.query).toEqual(["how", "do", "I", "restart", "docker"]);
      expect(args.options.copy).toBe(false);
    });

    it("should parse --provider and -p option", () => {
      const args1 = parseCliArgs(["--provider", "openai", "test"]);
      expect(args1.options.provider).toBe("openai");

      const args2 = parseCliArgs(["-p", "anthropic", "test"]);
      expect(args2.options.provider).toBe("anthropic");
    });

    it("should parse --model and -m option", () => {
      const args1 = parseCliArgs(["--model", "gpt-4o", "test"]);
      expect(args1.options.model).toBe("gpt-4o");

      const args2 = parseCliArgs(["-m", "claude-3", "test"]);
      expect(args2.options.model).toBe("claude-3");
    });

    it("should parse --copy flag", () => {
      const args = parseCliArgs(["--copy", "test"]);
      expect(args.options.copy).toBe(true);
      expect(args.options.noCopy).toBe(false);
    });

    it("should parse --no-copy flag", () => {
      const args = parseCliArgs(["--no-copy", "test"]);
      expect(args.options.noCopy).toBe(true);
      expect(args.options.copy).toBe(false);
    });

    it("should parse both --copy and --no-copy flags", () => {
      const args = parseCliArgs(["--copy", "--no-copy", "test"]);
      expect(args.options.copy).toBe(true);
      expect(args.options.noCopy).toBe(true);
    });

    it("should parse --debug flag", () => {
      const args = parseCliArgs(["--debug", "test"]);
      expect(args.options.debug).toBe(true);
    });

    it("should parse --help and -h flag", () => {
      const args1 = parseCliArgs(["--help"]);
      expect(args1.options.help).toBe(true);

      const args2 = parseCliArgs(["-h"]);
      expect(args2.options.help).toBe(true);
    });

    it("should parse --version and -v flag", () => {
      const args1 = parseCliArgs(["--version"]);
      expect(args1.options.version).toBe(true);

      const args2 = parseCliArgs(["-v"]);
      expect(args2.options.version).toBe(true);
    });

    it("should parse multiple flags together", () => {
      const args = parseCliArgs([
        "-p",
        "openai",
        "-m",
        "gpt-4o",
        "--copy",
        "what",
        "is",
        "recursion",
      ]);
      expect(args.options.provider).toBe("openai");
      expect(args.options.model).toBe("gpt-4o");
      expect(args.options.copy).toBe(true);
      expect(args.query).toEqual(["what", "is", "recursion"]);
    });

    it("should show help for empty query", () => {
      const args = parseCliArgs([]);
      expect(args.options.help).toBe(true);
      expect(args.query).toEqual([]);
    });
  });

  describe("config subcommands", () => {
    it("should parse config path", () => {
      const args = parseCliArgs(["config", "path"]);
      expect(args.command).toBe("config");
      expect(args.subcommand).toBe("path");
    });

    it("should parse config init", () => {
      const args = parseCliArgs(["config", "init"]);
      expect(args.command).toBe("config");
      expect(args.subcommand).toBe("init");
    });

    it("should throw for unknown config subcommand", () => {
      expect(() => parseCliArgs(["config", "unknown"])).toThrow(UsageError);
    });

    it("should throw for config without subcommand", () => {
      expect(() => parseCliArgs(["config"])).toThrow(UsageError);
    });
  });

  describe("providers command", () => {
    it("should parse providers command", () => {
      const args = parseCliArgs(["providers"]);
      expect(args.command).toBe("providers");
    });
  });

  describe("getHelpText", () => {
    it("should return help text", () => {
      const help = getHelpText();
      expect(help).toContain("q - Quick AI answers");
      expect(help).toContain("--provider");
      expect(help).toContain("--model");
      expect(help).toContain("--copy");
      expect(help).toContain("--no-copy");
      expect(help).toContain("Q_COPY");
    });
  });

  describe("getVersion", () => {
    it("should return version string", () => {
      const version = getVersion();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});
