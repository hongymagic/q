import { createAnthropic } from "@ai-sdk/anthropic";
import type { ProviderConfig } from "../config/index.ts";
import { createStandardProvider } from "./index.ts";

export function createAnthropicProvider(
  config: ProviderConfig,
  providerName: string,
) {
  return createStandardProvider(createAnthropic, config, providerName);
}
