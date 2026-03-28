import type { LanguageModel } from "ai";
import type { ConfigData, ProviderConfig } from "../config/index.ts";
import { env } from "../env.ts";
import {
  MissingApiKeyError,
  ModelNotConfiguredError,
  ProviderNotFoundError,
  SetupRequiredError,
} from "../errors.ts";
import { logDebug } from "../logging.ts";
import {
  getDefaultModelForProvider,
  getProviderStatusSummary,
} from "../provider-catalog.ts";
import { isSensitiveKey } from "../sensitive.ts";
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

export function resolveApiKeyCandidates(
  envVarNames: readonly string[],
  providerName: string,
): string {
  for (const envVarName of envVarNames) {
    const apiKey = process.env[envVarName];
    if (apiKey) {
      return apiKey;
    }
  }

  throw new MissingApiKeyError(envVarNames.join(" or "), providerName);
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
  const providerName =
    providerOverride ?? env.Q_PROVIDER ?? config.default.provider;
  if (!providerName) {
    throw new SetupRequiredError();
  }
  const providerConfig = config.providers[providerName];

  if (!providerConfig) {
    throw new ProviderNotFoundError(providerName);
  }

  // Resolution: CLI --model > Q_MODEL env > provider.model > config.default.model > built-in provider default
  // NOTE: config.default.model already includes Q_MODEL (applied during config
  // loading). The explicit env.Q_MODEL check here is still necessary so that
  // Q_MODEL takes precedence over providerConfig.model.
  const modelId =
    modelOverride ??
    env.Q_MODEL ??
    providerConfig.model ??
    config.default.model ??
    getDefaultModelForProvider(providerConfig);

  if (!modelId) {
    throw new ModelNotConfiguredError(providerName);
  }

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
 * List available providers with model and credential status
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
    const modelDisplay =
      providerConfig.model ??
      getDefaultModelForProvider(providerConfig) ??
      "(set with --model or config)";
    const modelLine = `    Model: ${modelDisplay}`;
    const credentialLines = getProviderStatusSummary(providerConfig).lines.map(
      (line) => `    ${line}`,
    );

    return [header, modelLine, ...credentialLines].join("\n");
  });

  const lines = [
    "Available providers:",
    "",
    ...providerBlocks,
    "",
    `Default provider: ${defaultProvider ?? "(choose with --provider or env)"}`,
    `Default model: ${defaultModel ?? "(provider default)"}`,
  ];

  return lines.join("\n");
}
