import { createAnthropic } from "@ai-sdk/anthropic";
import type { ProviderConfig } from "../config/index.ts";
import { MissingApiKeyError } from "../errors.ts";

/**
 * Create an Anthropic provider instance
 */
export function createAnthropicProvider(
  config: ProviderConfig,
  providerName: string,
) {
  let apiKey: string | undefined;

  if (config.api_key_env) {
    apiKey = process.env[config.api_key_env];
    if (!apiKey) {
      throw new MissingApiKeyError(config.api_key_env, providerName);
    }
  }

  return createAnthropic({
    apiKey,
    baseURL: config.base_url,
    headers: config.headers,
  });
}
