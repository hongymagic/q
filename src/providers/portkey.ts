import { createOpenAI } from "@ai-sdk/openai";
import type { ProviderConfig } from "../config/index.ts";
import { ConfigValidationError, logDebug } from "../errors.ts";
import { resolveApiKey } from "./index.ts";

/**
 * Portkey is an AI Gateway that routes to 250+ LLMs with a unified API.
 * This provider uses OpenAI SDK under the hood with Portkey-specific headers.
 *
 * IMPORTANT: We use openai.chat (Chat Completions API) instead of openai (Responses API)
 * because Portkey's backend providers (especially Bedrock) don't support the newer
 * OpenAI Responses API.
 */
export function createPortkeyProvider(
  config: ProviderConfig,
  providerName: string,
  debug = false,
) {
  if (!config.base_url) {
    throw new ConfigValidationError(
      `Provider '${providerName}' (type: portkey) requires 'base_url' to be set.\n` +
        `Example: base_url = "https://api.portkey.ai/v1"`,
    );
  }

  if (!config.provider_slug) {
    throw new ConfigValidationError(
      `Provider '${providerName}' (type: portkey) requires 'provider_slug' to be set.\n` +
        `Example: provider_slug = "@your-org/bedrock-provider"`,
    );
  }

  const headers: Record<string, string> = {
    "x-portkey-provider": config.provider_slug,
  };

  // Add Portkey API key if configured (x-portkey-api-key header)
  const portkeyApiKey = resolveApiKey(config.api_key_env, providerName);
  if (portkeyApiKey) {
    headers["x-portkey-api-key"] = portkeyApiKey;
  }

  // Add provider API key passthrough if configured (Authorization header)
  const providerApiKey = resolveApiKey(
    config.provider_api_key_env,
    providerName,
  );
  if (providerApiKey) {
    headers.Authorization = `Bearer ${providerApiKey}`;
  }

  // Merge any additional custom headers (already interpolated by Config class)
  if (config.headers) {
    Object.assign(headers, config.headers);
  }

  logDebug(`Portkey base URL: ${config.base_url}`, debug);
  logDebug(`Portkey headers:`, debug);
  for (const [key, value] of Object.entries(headers)) {
    const isSensitive =
      key.toLowerCase().includes("key") ||
      key.toLowerCase() === "authorization";
    const maskedValue =
      isSensitive && value.length > 12
        ? `${value.substring(0, 8)}...${value.substring(value.length - 4)}`
        : value;
    logDebug(`  ${key}: ${maskedValue}`, debug);
  }

  const provider = createOpenAI({
    apiKey: "portkey", // Dummy value; actual auth is in headers
    baseURL: config.base_url,
    headers,
  });

  // Use Chat Completions API (not Responses API) for Portkey compatibility
  logDebug("Using Chat Completions API (not Responses API)", debug);
  return provider.chat;
}
