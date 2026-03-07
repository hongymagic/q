#!/usr/bin/env bun
import type { ParsedArgs } from "./args.ts";
import { getHelpText, getVersion, parseCliArgs } from "./args.ts";
import { getConfigPath, initConfig, loadConfig } from "./config/index.ts";
import { formatEnvForDebug, getEnvironmentInfo } from "./env-info.ts";
import {
  getUserErrorMessage,
  QError,
  shouldWriteFailureLog,
  UsageError,
} from "./errors.ts";
import {
  canPromptForFailureRecovery,
  promptForFailureRecovery,
} from "./failure-prompt.ts";
import { startLoadingIndicator } from "./loading-indicator.ts";
import {
  configureLogging,
  formatErrorDiagnostics,
  logDebug,
  logError,
  printStderr,
  updateLogContext,
  writeFailureLog,
} from "./logging.ts";
import { buildSystemPrompt } from "./prompt.ts";
import { listProviders, resolveProvider } from "./providers/index.ts";
import { runQuery } from "./run.ts";
import type { StdinInput } from "./stdin.ts";
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
    configureLogging({ debug });
    updateLogContext({ command: args.command, configPath: getConfigPath() });

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
    const stdinMaxLength =
      args.query.length > 0 ? MAX_CONTEXT_LENGTH : MAX_QUERY_LENGTH;
    const stdinInput = await readStdin(stdinMaxLength);

    // Handle --help (after stdin check for proper stdin-only mode)
    // Show help if explicitly requested OR if no query and no stdin
    if (args.options.help && !stdinInput.hasInput && args.query.length === 0) {
      console.log(getHelpText());
      process.exit(0);
    }

    let attempt = 0;

    while (true) {
      attempt += 1;
      configureLogging({ debug });
      updateLogContext({
        attempt,
        command: args.command,
        configPath: getConfigPath(),
      });

      try {
        await runQueryAttempt(args, stdinInput, debug);
        process.exit(0);
      } catch (err) {
        const action = await handleFailure(err, debug, stdinInput);
        if (action === "retry") {
          continue;
        }

        if (err instanceof QError) {
          process.exit(err.exitCode);
        }

        process.exit(1);
      }
    }
  } catch (err) {
    configureLogging({ debug });
    updateLogContext({ configPath: getConfigPath() });
    await handleFailure(err, debug, null);

    if (err instanceof QError) {
      process.exit(err.exitCode);
    }

    process.exit(1);
  }
}

async function runQueryAttempt(
  args: ParsedArgs,
  stdinInput: StdinInput,
  debug: boolean,
): Promise<void> {
  // Resolve input mode and extract query/context
  const { mode, query, context } = resolveInput(stdinInput, args.query);
  updateLogContext({
    mode,
    queryLength: query.length,
    contextLength: context?.length ?? 0,
  });
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
  updateLogContext({ provider: providerName, model: modelId });

  const envInfo = getEnvironmentInfo();
  logDebug(`Query: ${query}`, debug);
  logDebug(`Provider: ${providerName}, Model: ${modelId}`, debug);
  logDebug(formatEnvForDebug(envInfo), debug);

  const loadingIndicator = startLoadingIndicator({
    enabled: process.stderr.isTTY === true,
  });

  try {
    // Run the query (streams directly to stdout)
    const result = await runQuery({
      model,
      query,
      context,
      systemPrompt: buildSystemPrompt(envInfo),
      onFirstChunk: () => loadingIndicator.stop(),
    });

    // Copy to clipboard if requested
    // Resolution: --no-copy > --copy > Q_COPY env > config.default.copy > false
    const shouldCopy =
      !args.options.noCopy && (args.options.copy || config.default.copy);

    if (shouldCopy) {
      try {
        const { default: clipboard } = await import("clipboardy");
        const { sanitizeForClipboard } = await import("./ansi.ts");
        const safeClipboardText = sanitizeForClipboard(result.text);
        await clipboard.write(safeClipboardText);
        logDebug("Copied to clipboard", debug);
      } catch {
        // Clipboard failure is non-fatal — the answer was already streamed to stdout.
        // Common causes: xclip/xsel not installed, headless server, Wayland without wl-copy.
        printStderr("Warning: could not copy to clipboard.");
      }
    }
  } finally {
    loadingIndicator.stop();
  }
}

async function handleFailure(
  err: unknown,
  debug: boolean,
  stdinInput: StdinInput | null,
): Promise<"exit" | "retry"> {
  const displayMessage = getUserErrorMessage(err);
  logError(`Error: ${displayMessage}`);

  if (debug) {
    printStderr(formatErrorDiagnostics(err));
  }

  let logPath: string | null = null;

  if (shouldWriteFailureLog(err)) {
    try {
      logPath = await writeFailureLog(err, displayMessage);
      printStderr(`Full log: ${logPath}`);
    } catch (logWriteErr) {
      printStderr("Could not write failure log.");

      if (debug) {
        printStderr(formatErrorDiagnostics(logWriteErr));
      }
    }
  }

  if (canRetryInteractively(err, stdinInput)) {
    return promptForFailureRecovery(logPath);
  }

  return "exit";
}

function canRetryInteractively(
  err: unknown,
  stdinInput: StdinInput | null,
): boolean {
  return (
    stdinInput !== null &&
    stdinInput.hasInput === false &&
    shouldWriteFailureLog(err) &&
    canPromptForFailureRecovery()
  );
}

main();
