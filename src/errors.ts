export class QError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "QError";
  }
}

export class ConfigNotFoundError extends QError {
  constructor(public readonly path: string) {
    super(
      `Config file not found: ${path}\nRun 'q config init' to create one.`,
      2,
    );
    this.name = "ConfigNotFoundError";
  }
}

export class ConfigParseError extends QError {
  constructor(
    public readonly path: string,
    public readonly details: string,
  ) {
    super(`Failed to parse config at ${path}:\n${details}`, 2);
    this.name = "ConfigParseError";
  }
}

export class ConfigValidationError extends QError {
  constructor(public readonly details: string) {
    super(`Invalid configuration:\n${details}`, 2);
    this.name = "ConfigValidationError";
  }
}

export class ProviderNotFoundError extends QError {
  constructor(public readonly providerName: string) {
    super(
      `Provider '${providerName}' not found in config.\nCheck your config file with 'q config path' and verify the provider is configured.`,
      2,
    );
    this.name = "ProviderNotFoundError";
  }
}

export class MissingApiKeyError extends QError {
  constructor(
    public readonly envVar: string,
    public readonly providerName: string,
  ) {
    super(
      `Missing API key: Environment variable '${envVar}' is not set for provider '${providerName}'.`,
      2,
    );
    this.name = "MissingApiKeyError";
  }
}

export class ProviderError extends QError {
  constructor(message: string, cause?: unknown) {
    super(message, 1, cause === undefined ? undefined : { cause });
    this.name = "ProviderError";
  }
}

export class UsageError extends QError {
  constructor(message: string) {
    super(message, 2);
    this.name = "UsageError";
  }
}

export function getUserErrorMessage(error: unknown): string {
  if (error instanceof ConfigNotFoundError) {
    return "Config file not found. Run 'q config init'.";
  }

  if (error instanceof ConfigParseError) {
    return "Could not parse config file.";
  }

  if (error instanceof ConfigValidationError) {
    return "Configuration is invalid. Check 'q config path'.";
  }

  if (error instanceof ProviderNotFoundError) {
    return `Provider '${error.providerName}' is not configured.`;
  }

  if (error instanceof MissingApiKeyError) {
    return `Missing API key. Set ${error.envVar}.`;
  }

  if (error instanceof ProviderError) {
    return getProviderUserMessage(error);
  }

  if (error instanceof QError) {
    return getFirstLine(error.message);
  }

  return "Unexpected error.";
}

export function shouldWriteFailureLog(error: unknown): boolean {
  return !(error instanceof UsageError);
}

function getFirstLine(message: string): string {
  const [firstLine = message] = message.split("\n", 1);
  return firstLine;
}

function getProviderUserMessage(error: ProviderError): string {
  const detail =
    extractProviderFailureDetail(error.cause) ??
    extractProviderFailureDetail(error.message);

  if (!detail) {
    return "AI request failed.";
  }

  return `AI request failed: ${detail}`;
}

function extractProviderFailureDetail(
  value: unknown,
  seen = new Set<unknown>(),
): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return normaliseProviderMessage(value);
  }

  if (typeof value !== "object") {
    return normaliseProviderMessage(String(value));
  }

  if (seen.has(value)) {
    return null;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const detail = extractProviderFailureDetail(value[index], seen);
      if (detail) {
        return detail;
      }
    }

    return null;
  }

  const record = value as Record<string, unknown>;
  const fromCode = normaliseProviderCode(record.code);
  if (fromCode) {
    return fromCode;
  }

  const fromStatus = normaliseProviderStatus(record.statusCode);
  if (fromStatus) {
    return fromStatus;
  }

  const fromCause = extractProviderFailureDetail(record.cause, seen);
  if (fromCause) {
    return fromCause;
  }

  const fromErrors = extractProviderFailureDetail(record.errors, seen);
  if (fromErrors) {
    return fromErrors;
  }

  if (typeof record.message === "string") {
    return normaliseProviderMessage(record.message);
  }

  return null;
}

function normaliseProviderCode(code: unknown): string | null {
  if (typeof code !== "string") {
    return null;
  }

  if (/^(?:ECONNREFUSED|ConnectionRefused)$/i.test(code)) {
    return "could not connect to provider (connection refused).";
  }

  if (/^(?:ETIMEDOUT|TimeoutError|ConnectionTimeout)$/i.test(code)) {
    return "request timed out.";
  }

  if (/^(?:ENOTFOUND|EAI_AGAIN)$/i.test(code)) {
    return "could not resolve the provider host.";
  }

  return null;
}

function normaliseProviderStatus(statusCode: unknown): string | null {
  if (typeof statusCode !== "number") {
    return null;
  }

  switch (statusCode) {
    case 401:
      return "authentication failed.";
    case 403:
      return "permission denied.";
    case 404:
      return "requested resource was not found.";
    case 429:
      return "rate limit exceeded.";
    default:
      return null;
  }
}

function normaliseProviderMessage(message: string): string | null {
  const cleaned = cleanProviderMessage(message);

  if (!cleaned) {
    return null;
  }

  if (/connection refused/i.test(cleaned)) {
    return "could not connect to provider (connection refused).";
  }

  if (/cannot connect to api|unable to connect/i.test(cleaned)) {
    return "could not connect to provider.";
  }

  if (/timed out|timeout/i.test(cleaned)) {
    return "request timed out.";
  }

  if (/rate limit/i.test(cleaned)) {
    return "rate limit exceeded.";
  }

  if (/unauthori[sz]ed|authentication/i.test(cleaned)) {
    return "authentication failed.";
  }

  if (/forbidden|permission denied/i.test(cleaned)) {
    return "permission denied.";
  }

  return ensureTrailingPunctuation(cleaned);
}

function cleanProviderMessage(message: string): string {
  const [firstLine = ""] = message
    .replace(/^AI request failed:\s*/i, "")
    .replace(/^Failed after \d+ attempts?\. Last error:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .split("\n", 1);

  return ensureTrailingPunctuation(firstLine.trim());
}

function ensureTrailingPunctuation(message: string): string {
  if (message === "") {
    return message;
  }

  return /[.!?]$/.test(message) ? message : `${message}.`;
}
