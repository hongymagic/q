import { readFile } from "node:fs/promises";
import { printStderr, writeStderrRaw } from "./logging.ts";

export type FailurePromptAction = "exit" | "retry" | "view_log";

export function canPromptForFailureRecovery(): boolean {
  return (
    process.stdin.isTTY === true &&
    process.stdout.isTTY === true &&
    process.stderr.isTTY === true &&
    typeof process.stdin.setRawMode === "function"
  );
}

export function getFailurePromptMessage(hasLogFile: boolean): string {
  if (hasLogFile) {
    return "Press r to retry, Enter to view the full log, or q to exit.";
  }

  return "Press r to retry or q to exit.";
}

export function getFailurePromptAction(
  input: string,
  hasLogFile: boolean,
): FailurePromptAction | null {
  if (input === "r" || input === "R") {
    return "retry";
  }

  if (
    input === "q" ||
    input === "Q" ||
    input === "\u0003" ||
    input === "\u001b"
  ) {
    return "exit";
  }

  if (hasLogFile && (input === "\r" || input === "\n")) {
    return "view_log";
  }

  return null;
}

export async function promptForFailureRecovery(
  logPath: string | null,
): Promise<Exclude<FailurePromptAction, "view_log">> {
  const hasLogFile = logPath !== null;

  while (true) {
    printStderr(getFailurePromptMessage(hasLogFile));

    const action = await readFailurePromptAction(hasLogFile);
    if (action === "view_log") {
      await showFailureLog(logPath);
      continue;
    }

    return action;
  }
}

async function readFailurePromptAction(
  hasLogFile: boolean,
): Promise<FailurePromptAction> {
  const stdin = process.stdin;
  const wasRaw = Boolean(
    (stdin as NodeJS.ReadStream & { isRaw?: boolean }).isRaw,
  );

  stdin.setRawMode?.(true);
  stdin.resume();

  try {
    return await new Promise<FailurePromptAction>((resolve) => {
      const onData = (chunk: Buffer | string) => {
        const input = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
        const action = getFailurePromptAction(input, hasLogFile);

        if (!action) {
          return;
        }

        stdin.off("data", onData);
        resolve(action);
      };

      stdin.on("data", onData);
    });
  } finally {
    stdin.setRawMode?.(wasRaw);
    stdin.pause();
  }
}

async function showFailureLog(logPath: string | null): Promise<void> {
  if (!logPath) {
    return;
  }

  const content = await readFile(logPath, "utf8");
  printStderr("");
  printStderr("Failure log:");
  writeStderrRaw(content);
}
