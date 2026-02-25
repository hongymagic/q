import { describe, expect, it } from "vitest";
import {
  ConfigSchema,
  formatZodErrors,
  McpConfigSchema,
  McpServerConfigSchema,
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

    it("should validate config with copy option", () => {
      const config = {
        default: {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          copy: true,
        },
        providers: {
          anthropic: {
            type: "anthropic",
            api_key_env: "ANTHROPIC_API_KEY",
          },
        },
      };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.default.copy).toBe(true);
      }
    });

    it("should allow copy to be false", () => {
      const config = {
        default: {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          copy: false,
        },
        providers: {
          anthropic: {
            type: "anthropic",
            api_key_env: "ANTHROPIC_API_KEY",
          },
        },
      };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.default.copy).toBe(false);
      }
    });

    it("should allow copy to be omitted (optional)", () => {
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
        },
      };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.default.copy).toBeUndefined();
      }
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

  describe("McpServerConfigSchema", () => {
    it("should validate a minimal server config", () => {
      const config = {
        url: "http://localhost:3001/mcp",
      };
      const result = McpServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should validate a server config with headers", () => {
      const config = {
        url: "http://localhost:3001/mcp",
        headers: {
          Authorization: "Bearer token",
          "X-Custom-Header": "value",
        },
      };
      const result = McpServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should reject server config without url", () => {
      const config = {
        headers: { Authorization: "Bearer token" },
      };
      const result = McpServerConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe("McpConfigSchema", () => {
    it("should validate a complete MCP config", () => {
      const config = {
        enabled: true,
        servers: {
          filesystem: { url: "http://localhost:3001/mcp" },
          github: {
            url: "http://localhost:3002/mcp",
            headers: { Authorization: "Bearer token" },
          },
        },
      };
      const result = McpConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should default enabled to true when not specified", () => {
      const config = {
        servers: {
          filesystem: { url: "http://localhost:3001/mcp" },
        },
      };
      const result = McpConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
      }
    });

    it("should allow enabled to be false", () => {
      const config = {
        enabled: false,
        servers: {
          filesystem: { url: "http://localhost:3001/mcp" },
        },
      };
      const result = McpConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(false);
      }
    });

    it("should default servers to empty object when not specified", () => {
      const config = {
        enabled: true,
      };
      const result = McpConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.servers).toEqual({});
      }
    });

    it("should allow empty servers object", () => {
      const config = {
        enabled: true,
        servers: {},
      };
      const result = McpConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe("ConfigSchema with MCP", () => {
    it("should validate config with MCP section", () => {
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
        },
        mcp: {
          enabled: true,
          servers: {
            filesystem: { url: "http://localhost:3001/mcp" },
          },
        },
      };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mcp?.enabled).toBe(true);
        expect(result.data.mcp?.servers?.filesystem?.url).toBe(
          "http://localhost:3001/mcp",
        );
      }
    });

    it("should validate config without MCP section (optional)", () => {
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
        },
      };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mcp).toBeUndefined();
      }
    });
  });
});
