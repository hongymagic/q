import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ProviderConfig } from "../config/index.ts";
import { ConfigValidationError } from "../errors.ts";
import { resolveApiKey } from "./index.ts";

export function createOpenAICompatibleProvider(
  config: ProviderConfig,
  providerName: string,
) {
  if (!config.base_url) {
    throw new ConfigValidationError(
      `Provider '${providerName}' (type: openai_compatible) requires 'base_url' to be set.`,
    );
  }

  return createOpenAICompatible({
    name: providerName,
    baseURL: config.base_url,
    apiKey: resolveApiKey(config.api_key_env, providerName),
    headers: config.headers,
  });
}
