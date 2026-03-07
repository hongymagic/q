import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigData } from "../src/config/index.ts";
import { MissingApiKeyError, ProviderNotFoundError } from "../src/errors.ts";
import {
  listProviders,
  resolveApiKey,
  resolveProvider,
} from "../src/providers/index.ts";
import { normaliseBaseURL } from "../src/providers/ollama.ts";

// Mutable mock for env module (createEnv validates at import time).
// vi.hoisted ensures this is available before hoisted vi.mock factories run.
const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    Q_PROVIDER: undefined as string | undefined,
    Q_MODEL: undefined as string | undefined,
    Q_COPY: undefined as boolean | undefined,
  },
}));

vi.mock("../src/env.ts", () => ({
  env: mockEnv,
}));

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
    mockEnv.Q_PROVIDER = undefined;
    mockEnv.Q_MODEL = undefined;
    mockEnv.Q_COPY = undefined;
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

    describe("per-provider model resolution", () => {
      const configWithProviderModels: ConfigData = {
        default: {
          provider: "anthropic",
          model: "global-default-model",
        },
        providers: {
          anthropic: {
            type: "anthropic",
            api_key_env: "ANTHROPIC_API_KEY",
            model: "claude-sonnet-4-20250514",
          },
          openai: {
            type: "openai",
            api_key_env: "OPENAI_API_KEY",
            model: "gpt-4o",
          },
          local: {
            type: "openai_compatible",
            base_url: "http://localhost:1234/v1",
            // No per-provider model — falls back to global default
          },
        },
      };

      it("should use per-provider model when no overrides", () => {
        const result = resolveProvider(configWithProviderModels);
        expect(result.modelId).toBe("claude-sonnet-4-20250514");
      });

      it("should use per-provider model for switched provider", () => {
        const result = resolveProvider(configWithProviderModels, "openai");
        expect(result.modelId).toBe("gpt-4o");
      });

      it("should fall back to global default when provider has no model", () => {
        const result = resolveProvider(configWithProviderModels, "local");
        expect(result.modelId).toBe("global-default-model");
      });

      it("should use CLI --model override over provider model", () => {
        const result = resolveProvider(
          configWithProviderModels,
          undefined,
          "cli-model-override",
        );
        expect(result.modelId).toBe("cli-model-override");
      });

      it("should use Q_MODEL over provider model but below CLI --model", () => {
        mockEnv.Q_MODEL = "env-model-override";
        const result = resolveProvider(configWithProviderModels);
        expect(result.modelId).toBe("env-model-override");
      });

      it("should prefer CLI --model over Q_MODEL", () => {
        mockEnv.Q_MODEL = "env-model-override";
        const result = resolveProvider(
          configWithProviderModels,
          undefined,
          "cli-model-override",
        );
        expect(result.modelId).toBe("cli-model-override");
      });
    });
  });

  describe("listProviders", () => {
    it("should list all providers with default marked", () => {
      const output = listProviders(mockConfig);
      expect(output).toContain("anthropic (default) [anthropic]");
      expect(output).toContain("openai");
      expect(output).toContain("local");
      expect(output).toContain("ollama");
      expect(output).toContain("Default model: claude-sonnet-4-20250514");
    });

    it("should show per-provider model when set", () => {
      const configWithModels: ConfigData = {
        default: { provider: "anthropic", model: "global-default" },
        providers: {
          anthropic: {
            type: "anthropic",
            api_key_env: "ANTHROPIC_API_KEY",
            model: "claude-sonnet-4-20250514",
          },
          openai: {
            type: "openai",
            api_key_env: "OPENAI_API_KEY",
          },
        },
      };
      const output = listProviders(configWithModels);
      expect(output).toContain("Model: claude-sonnet-4-20250514");
      expect(output).toContain("Model: (default)");
    });

    it("should show credential status", () => {
      const output = listProviders(mockConfig);
      // ANTHROPIC_API_KEY is set in beforeEach
      expect(output).toContain("Key: ANTHROPIC_API_KEY (set)");
      expect(output).toContain("Key: OPENAI_API_KEY (set)");
      // ollama has no api_key_env
      expect(output).toContain("Key: (none required)");
    });

    it("should report missing credentials", () => {
      delete process.env.OPENAI_API_KEY;
      const output = listProviders(mockConfig);
      expect(output).toContain("Key: OPENAI_API_KEY (missing)");
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

  describe("ollama normaliseBaseURL", () => {
    it("should default to http://localhost:11434/api when undefined", () => {
      expect(normaliseBaseURL(undefined)).toBe("http://localhost:11434/api");
    });

    it("should append /api when missing", () => {
      expect(normaliseBaseURL("http://localhost:11434")).toBe(
        "http://localhost:11434/api",
      );
    });

    it("should not double-append /api when already present", () => {
      expect(normaliseBaseURL("http://localhost:11434/api")).toBe(
        "http://localhost:11434/api",
      );
    });

    it("should strip trailing slashes before appending", () => {
      expect(normaliseBaseURL("http://localhost:11434/")).toBe(
        "http://localhost:11434/api",
      );
    });

    it("should handle custom host with /api suffix", () => {
      expect(normaliseBaseURL("http://ollama.local:8080/api")).toBe(
        "http://ollama.local:8080/api",
      );
    });

    it("should handle custom host without /api suffix", () => {
      expect(normaliseBaseURL("http://ollama.local:8080")).toBe(
        "http://ollama.local:8080/api",
      );
    });
  });
});
