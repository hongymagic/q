import type { LanguageModel } from "ai";
import type { ConfigData, ProviderConfig } from "../config/index.ts";
import { logDebug, ProviderNotFoundError } from "../errors.ts";
import { createAnthropicProvider } from "./anthropic.ts";
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
    `Provider config: ${JSON.stringify(providerConfig, null, 2)}`,
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
