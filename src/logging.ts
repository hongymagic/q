import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import envPaths from "env-paths";
import pc from "picocolors";
import pkg from "../package.json";
import { isSensitiveKey } from "./sensitive.ts";

type LogLevel = "debug" | "warn" | "error";
type LogContextValue = boolean | number | string;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

const sessionEntries: LogEntry[] = [];
const sessionContext = new Map<string, LogContextValue>();

export function configureLogging(options: { debug: boolean }): void {
  sessionEntries.length = 0;
  sessionContext.clear();
  updateLogContext({ debug: options.debug });
}

export function updateLogContext(
  context: Record<string, LogContextValue | null | undefined>,
): void {
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined || value === null) {
      continue;
    }

    sessionContext.set(key, value);
  }
}

export function logDebug(message: string, debug: boolean): void {
  if (!debug) {
    return;
  }

  recordLogEntry("debug", message);
  printStderr(`[debug] ${message}`);
}

export function logWarning(message: string): void {
  recordLogEntry("warn", message);
  printStderr(`Warning: ${message}`);
}

export function logError(message: string): void {
  recordLogEntry("error", message);
  printStderr(message);
}

export function printStderr(message: string): void {
  console.error(formatStderrMessage(message));
}

export function writeStderrRaw(message: string): void {
  process.stderr.write(message.endsWith("\n") ? message : `${message}\n`);
}

export function formatStderrMessage(
  message: string,
  colourEnabled?: boolean,
): string {
  const colours = pc.createColors(colourEnabled);

  if (message.startsWith("Error:")) {
    return formatPrefixedMessage(message, "Error:", (value) =>
      colours.bold(colours.red(value)),
    );
  }

  if (message.startsWith("Warning:")) {
    return formatPrefixedMessage(message, "Warning:", colours.yellow);
  }

  if (message.startsWith("[debug]")) {
    return formatPrefixedMessage(message, "[debug]", colours.dim);
  }

  if (message.startsWith("Full log:")) {
    const path = message.slice("Full log:".length).trimStart();
    return `${colours.dim("Full log:")} ${colours.cyan(path)}`;
  }

  return message;
}

export function formatErrorDiagnostics(error: unknown): string {
  return formatUnknownValue(error);
}

export function getFailureLogDir(): string {
  return join(envPaths("q", { suffix: "" }).log, "errors");
}

export async function writeFailureLog(
  error: unknown,
  displayMessage: string,
): Promise<string> {
  const logDir = getFailureLogDir();
  await mkdir(logDir, { recursive: true, mode: 0o700 });

  const timestamp = new Date();
  const fileName = `error-${timestamp.toISOString().replaceAll(":", "-")}.log`;
  const logPath = join(logDir, fileName);
  const report = buildFailureReport(
    timestamp.toISOString(),
    displayMessage,
    error,
  );

  await writeFile(logPath, report, { encoding: "utf8", mode: 0o600 });
  return logPath;
}

function recordLogEntry(level: LogLevel, message: string): void {
  sessionEntries.push({
    timestamp: new Date().toISOString(),
    level,
    message,
  });
}

function buildFailureReport(
  timestamp: string,
  displayMessage: string,
  error: unknown,
): string {
  const sections = [
    "q failure log",
    `Timestamp: ${timestamp}`,
    `Version: ${pkg.version}`,
    `Runtime: ${getRuntimeLabel()}`,
    `Platform: ${process.platform}`,
    `Architecture: ${process.arch}`,
    `Working directory: ${process.cwd()}`,
    "",
    "Display message:",
    displayMessage,
    "",
    "Session context:",
    formatSessionContext(),
    "",
    "Error details:",
    formatErrorDiagnostics(error),
    "",
    "Session log:",
    formatSessionEntries(),
    "",
  ];

  return sections.join("\n");
}

function getRuntimeLabel(): string {
  if (typeof Bun !== "undefined") {
    return `Bun ${Bun.version}`;
  }

  return `Node ${process.version}`;
}

function formatSessionContext(): string {
  if (sessionContext.size === 0) {
    return "(none)";
  }

  return [...sessionContext.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => {
      const displayValue = isSensitiveKey(key) ? "[REDACTED]" : String(value);
      return `${key}: ${displayValue}`;
    })
    .join("\n");
}

function formatSessionEntries(): string {
  if (sessionEntries.length === 0) {
    return "(none)";
  }

  return sessionEntries
    .map((entry) => `[${entry.timestamp}] [${entry.level}] ${entry.message}`)
    .join("\n");
}

// Error properties that may contain full request/response payloads (prompts, bodies).
// These are omitted entirely from failure logs.
const OMITTED_ERROR_PROPERTIES = new Set(["requestBodyValues", "responseBody"]);

function formatUnknownValue(value: unknown, depth = 0): string {
  const prefix = "  ".repeat(depth);

  if (value instanceof Error) {
    const lines = [
      `${prefix}name: ${value.name}`,
      `${prefix}message: ${value.message}`,
    ];

    const properties = Object.entries(value).filter(
      ([key]) =>
        key !== "name" &&
        key !== "message" &&
        key !== "stack" &&
        key !== "cause" &&
        !OMITTED_ERROR_PROPERTIES.has(key),
    );

    if (properties.length > 0) {
      lines.push(`${prefix}properties:`);
      for (const [key, propertyValue] of properties) {
        const displayValue = isSensitiveKey(key)
          ? "[REDACTED]"
          : formatValue(propertyValue);
        lines.push(`${prefix}  ${key}: ${displayValue}`);
      }
    }

    if (value.cause !== undefined) {
      lines.push(`${prefix}cause:`);
      lines.push(formatUnknownValue(value.cause, depth + 1));
    }

    if (value.stack) {
      lines.push(`${prefix}stack:`);
      lines.push(indentBlock(value.stack, depth + 1));
    }

    return lines.join("\n");
  }

  return `${prefix}${formatValue(value)}`;
}

function sensitiveKeyReplacer(key: string, value: unknown): unknown {
  if (key && isSensitiveKey(key)) {
    return "[REDACTED]";
  }
  return value;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value, sensitiveKeyReplacer, 2);
  } catch {
    return String(value);
  }
}

function indentBlock(value: string, depth: number): string {
  const prefix = "  ".repeat(depth);
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function formatPrefixedMessage(
  message: string,
  prefix: string,
  style: (value: string) => string,
): string {
  const remainder = message.slice(prefix.length);
  return `${style(prefix)}${remainder}`;
}
