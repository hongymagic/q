import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigData } from "../src/config/index.ts";
import { MissingApiKeyError, ProviderNotFoundError } from "../src/errors.ts";
import {
  listProviders,
  resolveApiKey,
  resolveProvider,
} from "../src/providers/index.ts";

// Mock the provider creation functions
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => (modelId: string) => ({ modelId, type: "openai" })),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => (modelId: string) => ({
    modelId,
    type: "anthropic",
  })),
}));

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => (modelId: string) => ({
    modelId,
    type: "openai-compatible",
  })),
}));

vi.mock("ollama-ai-provider-v2", () => ({
  createOllama: vi.fn(() => (modelId: string) => ({ modelId, type: "ollama" })),
}));

describe("provider resolution", () => {
  const mockConfig: ConfigData = {
    default: {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
    },
    providers: {
      anthropic: {
        type: "anthropic",
        api_key_env: "ANTHROPIC_API_KEY",
      },
      openai: {
        type: "openai",
        api_key_env: "OPENAI_API_KEY",
      },
      local: {
        type: "openai_compatible",
        base_url: "http://localhost:1234/v1",
      },
      ollama: {
        type: "ollama",
        base_url: "http://localhost:11434",
      },
    },
  };

  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ANTHROPIC_API_KEY: "test-anthropic-key",
      OPENAI_API_KEY: "test-openai-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("resolveProvider", () => {
    it("should use default provider and model when no overrides", () => {
      const result = resolveProvider(mockConfig);
      expect(result.providerName).toBe("anthropic");
      expect(result.modelId).toBe("claude-sonnet-4-20250514");
    });

    it("should use provider override", () => {
      const result = resolveProvider(mockConfig, "openai");
      expect(result.providerName).toBe("openai");
      expect(result.modelId).toBe("claude-sonnet-4-20250514"); // still default model
    });

    it("should use model override", () => {
      const result = resolveProvider(mockConfig, undefined, "gpt-4o");
      expect(result.providerName).toBe("anthropic");
      expect(result.modelId).toBe("gpt-4o");
    });

    it("should use both provider and model override", () => {
      const result = resolveProvider(mockConfig, "openai", "gpt-4o");
      expect(result.providerName).toBe("openai");
      expect(result.modelId).toBe("gpt-4o");
    });

    it("should throw ProviderNotFoundError for unknown provider", () => {
      expect(() => resolveProvider(mockConfig, "nonexistent")).toThrow(
        ProviderNotFoundError,
      );
    });

    it("should throw MissingApiKeyError when API key env var is not set", () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => resolveProvider(mockConfig)).toThrow(MissingApiKeyError);
    });

    it("should resolve ollama without API key", () => {
      const result = resolveProvider(mockConfig, "ollama");
      expect(result.providerName).toBe("ollama");
    });

    it("should resolve openai_compatible without API key when not required", () => {
      const result = resolveProvider(mockConfig, "local");
      expect(result.providerName).toBe("local");
    });
  });

  describe("listProviders", () => {
    it("should list all providers with default marked", () => {
      const output = listProviders(mockConfig);
      expect(output).toContain("anthropic");
      expect(output).toContain("(default)");
      expect(output).toContain("openai");
      expect(output).toContain("local");
      expect(output).toContain("ollama");
      expect(output).toContain("claude-sonnet-4-20250514");
    });
  });

  describe("resolveApiKey", () => {
    it("should return undefined when envVarName is undefined", () => {
      const result = resolveApiKey(undefined, "test-provider");
      expect(result).toBeUndefined();
    });

    it("should return API key when env var is set", () => {
      process.env.TEST_API_KEY = "my-secret-key";
      const result = resolveApiKey("TEST_API_KEY", "test-provider");
      expect(result).toBe("my-secret-key");
      delete process.env.TEST_API_KEY;
    });

    it("should throw MissingApiKeyError when env var is not set", () => {
      delete process.env.NONEXISTENT_KEY;
      expect(() => resolveApiKey("NONEXISTENT_KEY", "test-provider")).toThrow(
        MissingApiKeyError,
      );
    });

    it("should include provider name in error message", () => {
      expect(() => resolveApiKey("MISSING_KEY", "my-provider")).toThrow(
        /my-provider/,
      );
    });
  });
});
