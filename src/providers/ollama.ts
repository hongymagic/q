import { createOllama } from "ollama-ai-provider-v2";
import type { ProviderConfig } from "../config/index.ts";

/**
 * Create an Ollama provider instance
 * Ollama typically doesn't require an API key for local usage
 */
export function createOllamaProvider(config: ProviderConfig) {
  return createOllama({
    baseURL: config.base_url ?? "http://localhost:11434/api",
  });
}
