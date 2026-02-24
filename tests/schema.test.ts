import { describe, expect, it } from "vitest";
import {
  ConfigSchema,
  formatZodErrors,
  ProviderConfigSchema,
} from "../src/config/index.ts";

describe("config schema", () => {
  describe("ProviderConfigSchema", () => {
    it("should validate a valid openai provider config", () => {
      const config = {
        type: "openai",
        api_key_env: "OPENAI_API_KEY",
      };
      const result = ProviderConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should validate a valid anthropic provider config", () => {
      const config = {
        type: "anthropic",
        api_key_env: "ANTHROPIC_API_KEY",
      };
      const result = ProviderConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should validate openai_compatible with base_url", () => {
      const config = {
        type: "openai_compatible",
        base_url: "http://localhost:1234/v1",
        api_key_env: "LOCAL_KEY",
      };
      const result = ProviderConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should validate ollama provider config", () => {
      const config = {
        type: "ollama",
        base_url: "http://localhost:11434",
      };
      const result = ProviderConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should reject invalid provider type", () => {
      const config = {
        type: "invalid_provider",
        api_key_env: "SOME_KEY",
      };
      const result = ProviderConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should allow optional headers", () => {
      const config = {
        type: "openai",
        api_key_env: "OPENAI_API_KEY",
        headers: { "x-custom-header": "value" },
      };
      const result = ProviderConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe("ConfigSchema", () => {
    it("should validate a complete config", () => {
      const config = {
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
        },
      };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should reject config without default section", () => {
      const config = {
        providers: {
          anthropic: {
            type: "anthropic",
            api_key_env: "ANTHROPIC_API_KEY",
          },
        },
      };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject config without providers section", () => {
      const config = {
        default: {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
      };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe("formatZodErrors", () => {
    it("should format validation errors nicely", () => {
      const config = {
        default: {
          provider: "anthropic",
          // missing model
        },
        providers: {},
      };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formatted = formatZodErrors(result.error);
        expect(formatted).toContain("default.model");
        // Zod 4 error message format
        expect(formatted).toContain("expected string");
      }
    });
  });
});
