import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ProviderConfig } from "../config/index.ts";
import { ConfigValidationError, MissingApiKeyError } from "../errors.ts";

/**
 * Create an OpenAI-compatible provider instance
 * Used for local LLMs (LM Studio, etc.) and other OpenAI-compatible APIs
 */
export function createOpenAICompatibleProvider(
  config: ProviderConfig,
  providerName: string,
) {
  if (!config.base_url) {
    throw new ConfigValidationError(
      `Provider '${providerName}' (type: openai_compatible) requires 'base_url' to be set.`,
    );
  }

  let apiKey: string | undefined;

  if (config.api_key_env) {
    apiKey = process.env[config.api_key_env];
    if (!apiKey) {
      throw new MissingApiKeyError(config.api_key_env, providerName);
    }
  }

  return createOpenAICompatible({
    name: providerName,
    baseURL: config.base_url,
    apiKey,
    headers: config.headers,
  });
}
