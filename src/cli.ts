#!/usr/bin/env bun
import clipboard from "clipboardy";
import { getHelpText, getVersion, parseCliArgs } from "./args.ts";
import { getConfigPath, initConfig, loadConfig } from "./config/index.ts";
import { formatEnvForDebug, getEnvironmentInfo } from "./env-info.ts";
import { logDebug, logError, QError, UsageError } from "./errors.ts";
import { formatOutput } from "./output.ts";
import { buildSystemPrompt } from "./prompt.ts";
import { listProviders, resolveProvider } from "./providers/index.ts";
import { runQuery } from "./run.ts";

async function main(): Promise<void> {
  let debug = false;

  try {
    const args = parseCliArgs();
    debug = args.options.debug;

    // Handle --help
    if (args.options.help) {
      console.log(getHelpText());
      process.exit(0);
    }

    // Handle --version
    if (args.options.version) {
      console.log(getVersion());
      process.exit(0);
    }

    // Handle config subcommands
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

    // Handle providers command
    if (args.command === "providers") {
      const config = await loadConfig();
      console.log(listProviders(config));
      process.exit(0);
    }

    // Main query flow
    const query = args.query.join(" ");

    // Security: Limit query length to prevent abuse and excessive API costs
    const MAX_QUERY_LENGTH = 5000;
    if (query.length > MAX_QUERY_LENGTH) {
      throw new UsageError(
        `Query too long (${query.length} characters). Maximum is ${MAX_QUERY_LENGTH}.`,
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
    logDebug(`Stream: ${args.options.stream}`, debug);
    logDebug(formatEnvForDebug(envInfo), debug);

    // Run the query
    const result = await runQuery({
      model,
      query,
      systemPrompt: buildSystemPrompt(envInfo),
      stream: args.options.stream,
    });

    // Format and output (skip if streaming - already printed)
    if (!args.options.stream) {
      const output = formatOutput({
        text: result.text,
        providerName,
        modelId,
        json: args.options.json,
      });
      console.log(output);
    } else if (args.options.json) {
      // For streaming + json, output JSON after stream completes
      const output = formatOutput({
        text: result.text,
        providerName,
        modelId,
        json: true,
      });
      console.log(output);
    }

    // Copy to clipboard if requested
    if (args.options.copy) {
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
