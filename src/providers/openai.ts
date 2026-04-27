import { createOpenAI } from "@ai-sdk/openai";
import type { ProviderConfig } from "../config/index.ts";
import { createStandardProvider } from "./index.ts";

export function createOpenAIProvider(
  config: ProviderConfig,
  providerName: string,
) {
  return createStandardProvider(createOpenAI, config, providerName);
}
