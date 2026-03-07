import { accessSync, constants, openSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { ReadStream } from "node:tty";
import { printStderr, writeStderrRaw } from "./logging.ts";

export type FailurePromptAction = "exit" | "retry" | "view_log";

function hasTtyDevice(): boolean {
  try {
    accessSync("/dev/tty", constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function canPromptForFailureRecovery(): boolean {
  // Always need stdout + stderr as TTYs to display the prompt
  if (process.stdout.isTTY !== true || process.stderr.isTTY !== true) {
    return false;
  }

  // Prefer stdin if it's a TTY (normal interactive use)
  if (
    process.stdin.isTTY === true &&
    typeof process.stdin.setRawMode === "function"
  ) {
    return true;
  }

  // Stdin is piped — fall back to /dev/tty if available (Linux/macOS)
  return hasTtyDevice();
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

function openTtyStream(): ReadStream | null {
  try {
    const fd = openSync("/dev/tty", "r");
    return new ReadStream(fd);
  } catch {
    return null;
  }
}

async function readFailurePromptAction(
  hasLogFile: boolean,
): Promise<FailurePromptAction> {
  // Use process.stdin if it's a TTY, otherwise fall back to /dev/tty
  const useProcessStdin =
    process.stdin.isTTY === true &&
    typeof process.stdin.setRawMode === "function";
  const ttyStream = useProcessStdin ? null : openTtyStream();
  const stream = useProcessStdin ? process.stdin : ttyStream;

  if (!stream) {
    return "exit";
  }

  const wasRaw = Boolean(
    (stream as NodeJS.ReadStream & { isRaw?: boolean }).isRaw,
  );

  stream.setRawMode?.(true);
  stream.resume();

  try {
    return await new Promise<FailurePromptAction>((resolve) => {
      const onData = (chunk: Buffer | string) => {
        const input = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
        const action = getFailurePromptAction(input, hasLogFile);

        if (!action) {
          return;
        }

        stream.off("data", onData);
        resolve(action);
      };

      stream.on("data", onData);
    });
  } finally {
    stream.setRawMode?.(wasRaw);
    if (ttyStream) {
      ttyStream.destroy();
    } else {
      stream.pause();
    }
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
