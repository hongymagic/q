import type { LanguageModel } from "ai";
import type { ConfigData, ProviderConfig } from "../config/index.ts";
import {
  logDebug,
  MissingApiKeyError,
  ProviderNotFoundError,
} from "../errors.ts";
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

/**
 * Filter sensitive fields from a provider config for safe logging.
 * Removes any field containing: key, secret, token, password, auth, credential
 * @internal Exported for testing only
 */
export function filterSensitiveFields(
  config: ProviderConfig,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(config).filter(([key]) => {
      const lowerKey = key.toLowerCase();
      return !SENSITIVE_FIELD_PATTERNS.some((pattern) =>
        lowerKey.includes(pattern),
      );
    }),
  );
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

  const modelId = modelOverride ?? config.default.model;

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

/**
 * List all configured providers
 */
export function listProviders(config: ConfigData): string {
  const providers = Object.keys(config.providers);
  const defaultProvider = config.default.provider;
  const defaultModel = config.default.model;

  const lines = [
    "Configured providers:",
    "",
    ...providers.map((name) => {
      const isDefault = name === defaultProvider;
      const providerConfig = config.providers[name];
      const type = providerConfig?.type ?? "unknown";
      const marker = isDefault ? " (default)" : "";
      return `  ${name}${marker} [${type}]`;
    }),
    "",
    `Default model: ${defaultModel}`,
  ];

  return lines.join("\n");
}
