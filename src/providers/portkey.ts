import { createOpenAI } from "@ai-sdk/openai";
import type { ProviderConfig } from "../config/index.ts";
import {
  ConfigValidationError,
  logDebug,
  MissingApiKeyError,
} from "../errors.ts";

/**
 * Create a Portkey provider instance
 *
 * Portkey is an AI Gateway that routes to 250+ LLMs with a unified API.
 * This provider uses OpenAI SDK under the hood with Portkey-specific headers.
 *
 * IMPORTANT: We use openai.chat (Chat Completions API) instead of openai (Responses API)
 * because Portkey's backend providers (especially Bedrock) don't support the newer
 * OpenAI Responses API. The Chat Completions API is the industry standard that
 * Portkey translates to various provider formats.
 *
 * Required config:
 * - base_url: The Portkey gateway endpoint
 * - provider_slug: Maps to x-portkey-provider header (e.g., "@dev-platform/bedrock")
 *
 * Optional config:
 * - api_key_env: Env var for Portkey API key (x-portkey-api-key header)
 * - provider_api_key_env: Env var for provider API key passthrough (Authorization header)
 * - headers: Additional custom headers (supports ${VAR} interpolation)
 */
export function createPortkeyProvider(
  config: ProviderConfig,
  providerName: string,
  debug = false,
) {
  // Validate required fields for portkey type
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

  // Build headers starting with provider slug
  const headers: Record<string, string> = {
    "x-portkey-provider": config.provider_slug,
  };

  // Add Portkey API key if configured (x-portkey-api-key header)
  if (config.api_key_env) {
    const apiKey = process.env[config.api_key_env];
    if (!apiKey) {
      throw new MissingApiKeyError(config.api_key_env, providerName);
    }
    headers["x-portkey-api-key"] = apiKey;
  }

  // Add provider API key passthrough if configured (Authorization header)
  if (config.provider_api_key_env) {
    const providerApiKey = process.env[config.provider_api_key_env];
    if (!providerApiKey) {
      throw new MissingApiKeyError(config.provider_api_key_env, providerName);
    }
    headers.Authorization = `Bearer ${providerApiKey}`;
  }

  // Merge any additional custom headers (already interpolated by Config class)
  if (config.headers) {
    Object.assign(headers, config.headers);
  }

  // Debug logging
  logDebug(`Portkey base URL: ${config.base_url}`, debug);
  logDebug(`Portkey headers:`, debug);
  for (const [key, value] of Object.entries(headers)) {
    // Mask sensitive values (API keys)
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
    // OpenAI SDK requires an API key, but Portkey uses headers for auth
    // We pass a dummy value since the actual auth is in headers
    apiKey: "portkey",
    baseURL: config.base_url,
    headers,
  });

  // CRITICAL: Return provider.chat to use Chat Completions API (/v1/chat/completions)
  // instead of the default Responses API (/v1/responses).
  // Portkey's backend providers (Bedrock, Anthropic, etc.) don't support the Responses API.
  logDebug("Using Chat Completions API (not Responses API)", debug);
  return provider.chat;
}
