import { createOllama } from "ollama-ai-provider-v2";
import type { ProviderConfig } from "../config/index.ts";

export function createOllamaProvider(config: ProviderConfig) {
  return createOllama({
    baseURL: config.base_url ?? "http://localhost:11434/api",
  });
}
