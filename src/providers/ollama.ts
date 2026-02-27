import { createOllama } from "ollama-ai-provider-v2";
import type { ProviderConfig } from "../config/index.ts";

const DEFAULT_BASE_URL = "http://localhost:11434/api";

// Ollama's API lives under /api (e.g. /api/chat, /api/generate).
// Users naturally configure base_url as "http://localhost:11434" so
// we normalise by appending /api when it's missing.
export function normaliseBaseURL(url: string | undefined): string {
  if (!url) return DEFAULT_BASE_URL;

  const trimmed = url.replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

export function createOllamaProvider(config: ProviderConfig) {
  return createOllama({
    baseURL: normaliseBaseURL(config.base_url),
  });
}
