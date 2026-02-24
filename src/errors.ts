export class QError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
  ) {
    super(message);
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
  constructor(message: string) {
    super(message, 1);
    this.name = "ProviderError";
  }
}

export class UsageError extends QError {
  constructor(message: string) {
    super(message, 2);
    this.name = "UsageError";
  }
}

export function logError(message: string): void {
  console.error(message);
}

export function logDebug(message: string, debug: boolean): void {
  if (debug) {
    console.error(`[debug] ${message}`);
  }
}
