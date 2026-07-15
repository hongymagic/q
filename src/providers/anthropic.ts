import { createAnthropic } from "@ai-sdk/anthropic";
import type { ProviderConfig } from "../config/index.ts";
import { resolveApiKey } from "./index.ts";

// OAuth access tokens (from `ant auth login` or a Claude Code login session)
// authenticate over `Authorization: Bearer` plus this beta header, not
// `x-api-key` — a real Console API key needs neither. A key landing in
// ANTHROPIC_API_KEY isn't guaranteed to be a Console key (e.g. Claude Code
// exports its own OAuth token under that name for subprocess use), so this
// value has to be routed by shape rather than assumed.
const OAUTH_TOKEN_PREFIX = "sk-ant-oat";
const OAUTH_BETA_HEADER = "oauth-2025-04-20";

export function isOAuthAccessToken(key: string): boolean {
  return key.startsWith(OAUTH_TOKEN_PREFIX);
}

export function createAnthropicProvider(
  config: ProviderConfig,
  providerName: string,
) {
  const key = resolveApiKey(config.api_key_env, providerName);

  if (key && isOAuthAccessToken(key)) {
    return createAnthropic({
      authToken: key,
      baseURL: config.base_url,
      headers: {
        "anthropic-beta": OAUTH_BETA_HEADER,
        ...config.headers,
      },
    });
  }

  return createAnthropic({
    apiKey: key,
    baseURL: config.base_url,
    headers: config.headers,
  });
}
