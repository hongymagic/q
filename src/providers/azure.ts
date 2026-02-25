import { createAzure } from "@ai-sdk/azure";
import type { ProviderConfig } from "../config/index.ts";
import { resolveApiKey } from "./index.ts";

export function createAzureProvider(
  config: ProviderConfig,
  providerName: string,
) {
  return createAzure({
    apiKey: resolveApiKey(config.api_key_env, providerName),
    resourceName: config.resource_name,
    apiVersion: config.api_version,
    baseURL: config.base_url,
    headers: config.headers,
  });
}
