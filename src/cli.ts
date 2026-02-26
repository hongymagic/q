#!/usr/bin/env bun
import { getHelpText, getVersion, parseCliArgs } from "./args.ts";
import { getConfigPath, initConfig, loadConfig } from "./config/index.ts";
import { formatEnvForDebug, getEnvironmentInfo } from "./env-info.ts";
import { logDebug, logError, QError, UsageError } from "./errors.ts";
import { buildSystemPrompt } from "./prompt.ts";
import { listProviders, resolveProvider } from "./providers/index.ts";
import { runQuery } from "./run.ts";
import {
  MAX_CONTEXT_LENGTH,
  MAX_QUERY_LENGTH,
  readStdin,
  resolveInput,
} from "./stdin.ts";

async function main(): Promise<void> {
  let debug = false;

  try {
    const args = parseCliArgs();
    debug = args.options.debug;

    // Handle --version (before stdin to avoid blocking)
    if (args.options.version) {
      console.log(getVersion());
      process.exit(0);
    }

    // Handle config subcommands (before stdin to avoid blocking)
    if (args.command === "config") {
      if (args.subcommand === "path") {
        console.log(getConfigPath());
        process.exit(0);
      }
      if (args.subcommand === "init") {
        const result = await initConfig();
        console.log(result);
        process.exit(0);
      }
    }

    // Handle providers command (before stdin to avoid blocking)
    if (args.command === "providers") {
      const config = await loadConfig();
      console.log(listProviders(config));
      process.exit(0);
    }

    // Read stdin if piped (do this before help check)
    const stdinInput = await readStdin();

    // Handle --help (after stdin check for proper stdin-only mode)
    // Show help if explicitly requested OR if no query and no stdin
    if (args.options.help && !stdinInput.hasInput && args.query.length === 0) {
      console.log(getHelpText());
      process.exit(0);
    }

    // Resolve input mode and extract query/context
    const { mode, query, context } = resolveInput(stdinInput, args.query);
    logDebug(`Mode: ${mode}`, debug);

    // Security: Limit query length to prevent abuse and excessive API costs
    if (query.length > MAX_QUERY_LENGTH) {
      throw new UsageError(
        `Query too long (${query.length} characters). Maximum is ${MAX_QUERY_LENGTH}.`,
      );
    }

    // Security: Limit context length
    if (context && context.length > MAX_CONTEXT_LENGTH) {
      throw new UsageError(
        `Context too long (${context.length} characters). Maximum is ${MAX_CONTEXT_LENGTH}.`,
      );
    }

    logDebug("Loading config...", debug);
    const config = await loadConfig();

    logDebug(
      `Resolving provider: ${args.options.provider ?? config.default.provider}`,
      debug,
    );
    const { model, providerName, modelId } = resolveProvider(
      config,
      args.options.provider,
      args.options.model,
      debug,
    );

    const envInfo = getEnvironmentInfo();
    logDebug(`Query: ${query}`, debug);
    logDebug(`Provider: ${providerName}, Model: ${modelId}`, debug);
    logDebug(formatEnvForDebug(envInfo), debug);

    // Run the query (streams directly to stdout)
    const result = await runQuery({
      model,
      query,
      context,
      systemPrompt: buildSystemPrompt(envInfo),
    });

    // Copy to clipboard if requested
    // Resolution: --no-copy > --copy > Q_COPY env > config.default.copy > false
    const shouldCopy =
      !args.options.noCopy && (args.options.copy || config.default.copy);

    if (shouldCopy) {
      const { default: clipboard } = await import("clipboardy");
      await clipboard.write(result.text);
      logDebug("Copied to clipboard", debug);
    }

    process.exit(0);
  } catch (err) {
    if (err instanceof QError) {
      logError(err.message);
      process.exit(err.exitCode);
    }

    // Unexpected error
    const message = err instanceof Error ? err.message : String(err);
    logError(`Unexpected error: ${message}`);

    if (debug && err instanceof Error && err.stack) {
      logError(err.stack);
    }

    process.exit(1);
  }
}

main();
