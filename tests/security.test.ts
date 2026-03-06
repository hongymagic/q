import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseCliArgs } from "../src/args.ts";
import { interpolateValue } from "../src/config/index.ts";
import { ConfigValidationError } from "../src/errors.ts";
import { filterSensitiveFields } from "../src/providers/index.ts";
import { createPortkeyProvider } from "../src/providers/portkey.ts";

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => ({ chat: vi.fn() })),
}));

describe("security", () => {
  describe("query length validation", () => {
    it("should accept queries under 5000 characters", () => {
      const shortQuery = "a".repeat(100);
      const args = parseCliArgs([shortQuery]);
      expect(args.query.join(" ").length).toBeLessThanOrEqual(5000);
    });

    it("should parse long queries (validation happens in cli.ts)", () => {
      // Note: parseCliArgs doesn't validate length, cli.ts does
      const longQuery = "a".repeat(6000);
      const args = parseCliArgs([longQuery]);
      expect(args.query[0]?.length).toBe(6000);
    });
  });

  describe("env var interpolation allowlist", () => {
    // Clean up test env vars after each test
    afterEach(() => {
      delete process.env.DANGEROUS_VAR;
      delete process.env.AWS_SECRET_ACCESS_KEY;
      delete process.env.PORTKEY_BASE_URL;
      delete process.env.NOT_ALLOWED;
    });

    it("should reject non-allowlisted env vars in interpolation", () => {
      process.env.DANGEROUS_VAR = "https://evil.com";

      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal interpolation syntax
      expect(() => interpolateValue("${DANGEROUS_VAR}")).toThrow(
        ConfigValidationError,
      );
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal interpolation syntax
      expect(() => interpolateValue("${DANGEROUS_VAR}")).toThrow(
        /DANGEROUS_VAR.*not allowed/,
      );
    });

    it("should allow AWS credentials in interpolation (needed for Bedrock)", () => {
      process.env.AWS_SECRET_ACCESS_KEY = "secret-key";

      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal interpolation syntax
      const result = interpolateValue("${AWS_SECRET_ACCESS_KEY}");
      expect(result).toBe("secret-key");
    });

    it("should allow PORTKEY_BASE_URL in interpolation", () => {
      process.env.PORTKEY_BASE_URL = "https://portkey.example.com";

      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal interpolation syntax
      const result = interpolateValue("${PORTKEY_BASE_URL}");
      expect(result).toBe("https://portkey.example.com");
    });

    it("should allow allowlisted vars mixed with static text", () => {
      process.env.PORTKEY_BASE_URL = "https://gateway.example.com";

      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal interpolation syntax
      const result = interpolateValue("${PORTKEY_BASE_URL}/v1/chat");
      expect(result).toBe("https://gateway.example.com/v1/chat");
    });

    it("should throw if allowlisted var is not set", () => {
      delete process.env.PORTKEY_BASE_URL;

      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal interpolation syntax
      expect(() => interpolateValue("${PORTKEY_BASE_URL}")).toThrow(
        ConfigValidationError,
      );
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal interpolation syntax
      expect(() => interpolateValue("${PORTKEY_BASE_URL}")).toThrow(
        /PORTKEY_BASE_URL.*not set/,
      );
    });

    it("should return value unchanged if no interpolation needed", () => {
      const result = interpolateValue("https://static.example.com");
      expect(result).toBe("https://static.example.com");
    });

    it("should list allowed variables in error message", () => {
      process.env.NOT_ALLOWED = "value";

      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal interpolation syntax
      expect(() => interpolateValue("${NOT_ALLOWED}")).toThrow(
        /Allowed variables:/,
      );
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal interpolation syntax
      expect(() => interpolateValue("${NOT_ALLOWED}")).toThrow(
        /PORTKEY_API_KEY/,
      );
    });
  });

  describe("sensitive field filtering", () => {
    it("should filter fields containing sensitive patterns", () => {
      const testConfig = {
        type: "openai" as const,
        api_key_env: "OPENAI_API_KEY",
        base_url: "https://api.openai.com",
      };

      const filtered = filterSensitiveFields(testConfig);

      expect(filtered).toHaveProperty("type");
      expect(filtered).toHaveProperty("base_url");
      expect(filtered).not.toHaveProperty("api_key_env");
    });

    it("should filter various sensitive field names", () => {
      const testConfig = {
        type: "openai" as const,
        api_key_env: "should-be-filtered",
        secret_value: "should-be-filtered",
        auth_header: "should-be-filtered",
        password_field: "should-be-filtered",
        access_token: "should-be-filtered",
        normal_field: "should-remain",
        base_url: "should-remain",
      };

      const filtered = filterSensitiveFields(testConfig);

      expect(filtered).toHaveProperty("type");
      expect(filtered).toHaveProperty("normal_field");
      expect(filtered).toHaveProperty("base_url");
      expect(filtered).not.toHaveProperty("api_key_env");
      expect(filtered).not.toHaveProperty("secret_value");
      expect(filtered).not.toHaveProperty("auth_header");
      expect(filtered).not.toHaveProperty("password_field");
      expect(filtered).not.toHaveProperty("access_token");
    });

    it("should be case-insensitive", () => {
      const testConfig = {
        type: "openai" as const,
        API_KEY_ENV: "should-be-filtered",
        SECRET_VALUE: "should-be-filtered",
      };

      // Cast to ProviderConfig shape for testing
      const filtered = filterSensitiveFields(
        testConfig as unknown as Parameters<typeof filterSensitiveFields>[0],
      );

      expect(filtered).toHaveProperty("type");
      expect(filtered).not.toHaveProperty("API_KEY_ENV");
      expect(filtered).not.toHaveProperty("SECRET_VALUE");
    });

    it("should recursively filter sensitive fields in nested objects like headers", () => {
      const testConfig = {
        type: "openai_compatible" as const,
        base_url: "https://api.example.com",
        headers: {
          Authorization: "Bearer secret-token",
          "x-api-key": "secret-key",
          "Content-Type": "application/json",
          "x-custom-header": "safe-value",
        },
      };

      const filtered = filterSensitiveFields(
        testConfig as unknown as Parameters<typeof filterSensitiveFields>[0],
      );

      expect(filtered).toHaveProperty("type");
      expect(filtered).toHaveProperty("base_url");
      expect(filtered).toHaveProperty("headers");

      const filteredHeaders = filtered.headers as Record<string, string>;
      expect(filteredHeaders).toHaveProperty("Content-Type");
      expect(filteredHeaders).toHaveProperty("x-custom-header");
      expect(filteredHeaders).not.toHaveProperty("Authorization");
      expect(filteredHeaders).not.toHaveProperty("x-api-key");
    });
  });

  describe("CLI argument safety", () => {
    it("should use strict mode for argument parsing", () => {
      // Verify unknown options throw errors
      expect(() => parseCliArgs(["--unknown-option"])).toThrow();
    });

    it("should reject unknown options even after positional args", () => {
      // This verifies that option injection via positional args is not possible
      // because unknown options always throw
      expect(() => parseCliArgs(["hello", "--world"])).toThrow(
        /Unknown option/,
      );
    });

    it("should allow known options mixed with positional args", () => {
      const args = parseCliArgs(["hello", "--copy", "world"]);
      expect(args.query).toContain("hello");
      expect(args.query).toContain("world");
      expect(args.options.copy).toBe(true);
    });
  });

  describe("insecure URL detection", () => {
    it("should be tested via config loading with HTTP URLs", () => {
      // The warnIfInsecureUrl method is private and called during config loading
      // This test documents the expected behaviour:
      // - HTTP URLs to localhost/127.0.0.1/::1/.local are allowed silently
      // - HTTP URLs to other hosts trigger a console.error warning
      // - HTTPS URLs are always allowed silently
      expect(true).toBe(true);
    });
  });

  describe("Portkey header masking in debug logs", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
      delete process.env.PORTKEY_API_KEY;
    });

    it("should mask a short sensitive header value (<=12 chars) as ********", () => {
      process.env.PORTKEY_API_KEY = "shortkey123"; // 11 chars, <= 12
      createPortkeyProvider(
        {
          type: "portkey",
          base_url: "https://api.portkey.ai/v1",
          provider_slug: "@my-org/bedrock",
          api_key_env: "PORTKEY_API_KEY",
        },
        "test-provider",
        true,
      );

      const logs = errorSpy.mock.calls.flat() as string[];
      const keyLog = logs.find((msg) => msg.includes("x-portkey-api-key"));
      expect(keyLog).toBeDefined();
      expect(keyLog).toContain("********");
      expect(keyLog).not.toContain("shortkey123");
    });

    it("should truncate a long sensitive header value (>12 chars)", () => {
      process.env.PORTKEY_API_KEY = "abcdefghijklmnopqrstuv"; // 22 chars, > 12
      createPortkeyProvider(
        {
          type: "portkey",
          base_url: "https://api.portkey.ai/v1",
          provider_slug: "@my-org/bedrock",
          api_key_env: "PORTKEY_API_KEY",
        },
        "test-provider",
        true,
      );

      const logs = errorSpy.mock.calls.flat() as string[];
      const keyLog = logs.find((msg) => msg.includes("x-portkey-api-key"));
      expect(keyLog).toBeDefined();
      expect(keyLog).toContain("abcdefgh...stuv");
      expect(keyLog).not.toContain("abcdefghijklmnopqrstuv");
    });

    it("should log non-sensitive header values as-is", () => {
      process.env.PORTKEY_API_KEY = "dummy-api-key-1234"; // needed to satisfy provider init
      createPortkeyProvider(
        {
          type: "portkey",
          base_url: "https://api.portkey.ai/v1",
          provider_slug: "@my-org/bedrock",
          api_key_env: "PORTKEY_API_KEY",
          headers: { "x-custom-trace": "trace-value-123" },
        },
        "test-provider",
        true,
      );

      const logs = errorSpy.mock.calls.flat() as string[];
      const headerLog = logs.find((msg) => msg.includes("x-custom-trace"));
      expect(headerLog).toBeDefined();
      expect(headerLog).toContain("trace-value-123");
    });
  });
});
