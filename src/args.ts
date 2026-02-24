import { parseArgs } from "node:util";
import { UsageError } from "./errors.ts";

export type Command = "query" | "config" | "providers";
export type ConfigSubcommand = "path" | "init";

export interface ParsedArgs {
  command: Command;
  subcommand?: ConfigSubcommand;
  query: string[];
  options: {
    provider?: string;
    model?: string;
    stream: boolean;
    copy: boolean;
    json: boolean;
    debug: boolean;
    help: boolean;
    version: boolean;
  };
}

const HELP_TEXT = `q - Quick AI answers from the command line

USAGE:
  q [options] <query...>       Ask a question
  q config path                Print config file path
  q config init                Create example config file
  q providers                  List configured providers

OPTIONS:
  -p, --provider <name>        Override the default provider
  -m, --model <id>             Override the default model
  --stream                     Stream response tokens as they arrive
  --copy                       Copy answer to clipboard
  --json                       Output structured JSON
  --debug                      Enable debug logging to stderr
  -h, --help                   Show this help message
  -v, --version                Show version

ENVIRONMENT:
  Q_PROVIDER                   Override default provider
  Q_MODEL                      Override default model

CONFIG:
  Config is loaded from (in order, later overrides earlier):
    1. ~/.config/q/config.toml (or $XDG_CONFIG_HOME/q/config.toml)
    2. ./config.toml (current directory)
    3. Environment variables (Q_PROVIDER, Q_MODEL)

EXAMPLES:
  q how do I restart docker
  q --stream explain git rebase
  q -p openai --model gpt-4o what is recursion
  q config init
`;

const VERSION = "0.3.0";

export function parseCliArgs(argv: string[] = Bun.argv.slice(2)): ParsedArgs {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      provider: { type: "string", short: "p" },
      model: { type: "string", short: "m" },
      stream: { type: "boolean", default: false },
      copy: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      debug: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  const options = {
    provider: values.provider,
    model: values.model,
    stream: values.stream ?? false,
    copy: values.copy ?? false,
    json: values.json ?? false,
    debug: values.debug ?? false,
    help: values.help ?? false,
    version: values.version ?? false,
  };

  if (options.help || options.version) {
    return {
      command: "query",
      query: [],
      options,
    };
  }

  const firstArg = positionals[0]?.toLowerCase();

  if (firstArg === "config") {
    const subArg = positionals[1]?.toLowerCase();
    if (subArg === "path" || subArg === "init") {
      return {
        command: "config",
        subcommand: subArg,
        query: [],
        options,
      };
    }
    throw new UsageError(
      `Unknown config subcommand: '${subArg ?? "(none)"}'\nValid subcommands: path, init`,
    );
  }

  if (firstArg === "providers") {
    return {
      command: "providers",
      query: [],
      options,
    };
  }

  if (positionals.length === 0) {
    return {
      command: "query",
      query: [],
      options: { ...options, help: true },
    };
  }

  return {
    command: "query",
    query: positionals,
    options,
  };
}

export function getHelpText(): string {
  return HELP_TEXT;
}

export function getVersion(): string {
  return VERSION;
}
