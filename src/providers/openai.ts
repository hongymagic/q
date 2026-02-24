import { createOpenAI } from "@ai-sdk/openai";
import type { ProviderConfig } from "../config/index.ts";
import { MissingApiKeyError } from "../errors.ts";

export function createOpenAIProvider(
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

  return createOpenAI({
    apiKey,
    baseURL: config.base_url,
    headers: config.headers,
  });
}
