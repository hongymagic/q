import { createGroq } from "@ai-sdk/groq";
import type { ProviderConfig } from "../config/index.ts";
import { createStandardProvider } from "./index.ts";

export function createGroqProvider(
  config: ProviderConfig,
  providerName: string,
) {
  return createStandardProvider(createGroq, config, providerName);
}
