import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ProviderConfig } from "../config/index.ts";
import { getGoogleApiKeyEnvVars } from "../provider-catalog.ts";
import { resolveApiKeyCandidates } from "./index.ts";

export function createGoogleProvider(
  config: ProviderConfig,
  providerName: string,
) {
  return createGoogleGenerativeAI({
    apiKey: resolveApiKeyCandidates(
      getGoogleApiKeyEnvVars(config.api_key_env),
      providerName,
    ),
    baseURL: config.base_url,
    headers: config.headers,
  });
}
