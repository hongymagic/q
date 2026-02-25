import { createAnthropic } from "@ai-sdk/anthropic";
import type { ProviderConfig } from "../config/index.ts";
import { resolveApiKey } from "./index.ts";

export function createAnthropicProvider(
  config: ProviderConfig,
  providerName: string,
) {
  return createAnthropic({
    apiKey: resolveApiKey(config.api_key_env, providerName),
    baseURL: config.base_url,
    headers: config.headers,
  });
}
