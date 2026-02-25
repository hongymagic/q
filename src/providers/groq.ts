import { createGroq } from "@ai-sdk/groq";
import type { ProviderConfig } from "../config/index.ts";
import { resolveApiKey } from "./index.ts";

export function createGroqProvider(
  config: ProviderConfig,
  providerName: string,
) {
  return createGroq({
    apiKey: resolveApiKey(config.api_key_env, providerName),
    baseURL: config.base_url,
    headers: config.headers,
  });
}
