import type { LanguageModel } from "ai";
import type { ConfigData, ProviderConfig } from "../config/index.ts";
import { env } from "../env.ts";
import { MissingApiKeyError, ProviderNotFoundError } from "../errors.ts";
import { logDebug } from "../logging.ts";
import { createAnthropicProvider } from "./anthropic.ts";
import { createAzureProvider } from "./azure.ts";
import { createBedrockProvider } from "./bedrock.ts";
import { createGoogleProvider } from "./google.ts";
import { createGroqProvider } from "./groq.ts";
import { createOllamaProvider } from "./ollama.ts";
import { createOpenAIProvider } from "./openai.ts";
import { createOpenAICompatibleProvider } from "./openaiCompatible.ts";
import { createPortkeyProvider } from "./portkey.ts";

export interface ResolvedProvider {
  model: LanguageModel;
  providerName: string;
  modelId: string;
}

const SENSITIVE_FIELD_PATTERNS = [
  "key",
  "secret",
  "token",
  "password",
  "auth",
  "credential",
];

function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => lowerKey.includes(pattern));
}

/**
 * Filter sensitive fields from a provider config for safe logging.
 * Removes sensitive fields recursively using a JSON replacer to safely
 * handle arrays and nested objects without mutating the original.
 * @internal Exported for testing only
 */
export function filterSensitiveFields(
  config: Record<string, unknown>,
): Record<string, unknown> {
  try {
    return JSON.parse(
      JSON.stringify(config, (key, value) => {
        if (!key) {
          return value;
        }
        return isSensitiveKey(key) ? undefined : value;
      }),
    );
  } catch {
    return {};
  }
}

/**
 * Resolve an API key from an environment variable name.
 * Returns undefined if envVarName is not provided.
 * Throws MissingApiKeyError if envVarName is provided but the env var is not set.
 */
export function resolveApiKey(
  envVarName: string | undefined,
  providerName: string,
): string | undefined {
  if (!envVarName) {
    return undefined;
  }

  const apiKey = process.env[envVarName];
  if (!apiKey) {
    throw new MissingApiKeyError(envVarName, providerName);
  }

  return apiKey;
}

/**
 * Resolve a provider and model from config, with optional overrides
 */
export function resolveProvider(
  config: ConfigData,
  providerOverride?: string,
  modelOverride?: string,
  debug = false,
): ResolvedProvider {
  const providerName = providerOverride ?? config.default.provider;
  const providerConfig = config.providers[providerName];

  if (!providerConfig) {
    throw new ProviderNotFoundError(providerName);
  }

  // Resolution: CLI --model > Q_MODEL env > provider.model > config.default.model
  const modelId =
    modelOverride ??
    env.Q_MODEL ??
    providerConfig.model ??
    config.default.model;

  logDebug(
    `Provider config: ${JSON.stringify(filterSensitiveFields(providerConfig), null, 2)}`,
    debug,
  );

  const model = createModel(providerConfig, providerName, modelId, debug);

  return {
    model,
    providerName,
    modelId,
  };
}

/**
 * Create a language model from provider config
 */
function createModel(
  config: ProviderConfig,
  providerName: string,
  modelId: string,
  debug = false,
): LanguageModel {
  switch (config.type) {
    case "openai": {
      const provider = createOpenAIProvider(config, providerName);
      return provider(modelId);
    }
    case "anthropic": {
      const provider = createAnthropicProvider(config, providerName);
      return provider(modelId);
    }
    case "openai_compatible": {
      const provider = createOpenAICompatibleProvider(config, providerName);
      return provider(modelId);
    }
    case "ollama": {
      const provider = createOllamaProvider(config);
      return provider(modelId);
    }
    case "portkey": {
      const provider = createPortkeyProvider(config, providerName, debug);
      return provider(modelId);
    }
    case "google": {
      const provider = createGoogleProvider(config, providerName);
      return provider(modelId);
    }
    case "groq": {
      const provider = createGroqProvider(config, providerName);
      return provider(modelId);
    }
    case "azure": {
      const provider = createAzureProvider(config, providerName);
      return provider(modelId);
    }
    case "bedrock": {
      const provider = createBedrockProvider(config, providerName);
      return provider(modelId);
    }
  }
}

type CredentialStatus = {
  envVar: string;
  present: boolean;
};

function getCredentialStatuses(
  providerConfig: ProviderConfig,
): CredentialStatus[] {
  const statuses: CredentialStatus[] = [];

  if (providerConfig.api_key_env) {
    statuses.push({
      envVar: providerConfig.api_key_env,
      present: Boolean(process.env[providerConfig.api_key_env]),
    });
  }

  // Portkey has an additional provider API key
  if (providerConfig.provider_api_key_env) {
    statuses.push({
      envVar: providerConfig.provider_api_key_env,
      present: Boolean(process.env[providerConfig.provider_api_key_env]),
    });
  }

  // Bedrock has optional AWS credential env vars
  if (providerConfig.access_key_env) {
    statuses.push({
      envVar: providerConfig.access_key_env,
      present: Boolean(process.env[providerConfig.access_key_env]),
    });
  }

  if (providerConfig.secret_key_env) {
    statuses.push({
      envVar: providerConfig.secret_key_env,
      present: Boolean(process.env[providerConfig.secret_key_env]),
    });
  }

  return statuses;
}

function formatCredentialLine(statuses: CredentialStatus[]): string {
  if (statuses.length === 0) {
    return "    Key: (none required)";
  }

  return statuses
    .map(({ envVar, present }) => {
      const status = present ? "set" : "missing";
      return `    Key: ${envVar} (${status})`;
    })
    .join("\n");
}

/**
 * List all configured providers with model and credential status
 */
export function listProviders(config: ConfigData): string {
  const providers = Object.keys(config.providers);
  const defaultProvider = config.default.provider;
  const defaultModel = config.default.model;

  const providerBlocks = providers.map((name) => {
    const isDefault = name === defaultProvider;
    const providerConfig = config.providers[name];
    if (!providerConfig) return `  ${name} [unknown]`;

    const marker = isDefault ? " (default)" : "";
    const header = `  ${name}${marker} [${providerConfig.type}]`;
    const modelDisplay = providerConfig.model ?? "(default)";
    const modelLine = `    Model: ${modelDisplay}`;
    const credentialLine = formatCredentialLine(
      getCredentialStatuses(providerConfig),
    );

    return [header, modelLine, credentialLine].join("\n");
  });

  const lines = [
    "Configured providers:",
    "",
    ...providerBlocks,
    "",
    `Default model: ${defaultModel}`,
  ];

  return lines.join("\n");
}
