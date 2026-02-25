import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ProviderConfig } from "../config/index.ts";
import { resolveApiKey } from "./index.ts";

export function createGoogleProvider(
  config: ProviderConfig,
  providerName: string,
) {
  return createGoogleGenerativeAI({
    apiKey: resolveApiKey(config.api_key_env, providerName),
    baseURL: config.base_url,
    headers: config.headers,
  });
}
