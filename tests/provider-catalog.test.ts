import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectLocalProvider,
  getDefaultModelForProvider,
  getDefaultModelForProviderType,
  inferProviderFromEnvironment,
} from "../src/provider-catalog.ts";

describe("inferProviderFromEnvironment", () => {
  it("returns undefined when no relevant env vars are set", () => {
    expect(inferProviderFromEnvironment({})).toBeUndefined();
  });

  it("prefers google when GEMINI_API_KEY is present", () => {
    expect(
      inferProviderFromEnvironment({
        GEMINI_API_KEY: "gemini-key",
        OPENAI_API_KEY: "openai-key",
      }),
    ).toBe("google");
  });

  it("recognises GOOGLE_API_KEY as a google trigger", () => {
    expect(inferProviderFromEnvironment({ GOOGLE_API_KEY: "google-key" })).toBe(
      "google",
    );
  });

  it("recognises GOOGLE_GENERATIVE_AI_API_KEY as a google trigger", () => {
    expect(
      inferProviderFromEnvironment({
        GOOGLE_GENERATIVE_AI_API_KEY: "google-key",
      }),
    ).toBe("google");
  });

  it("falls back to groq when only GROQ_API_KEY is set", () => {
    expect(inferProviderFromEnvironment({ GROQ_API_KEY: "groq-key" })).toBe(
      "groq",
    );
  });

  it("falls back to anthropic when only ANTHROPIC_API_KEY is set", () => {
    expect(
      inferProviderFromEnvironment({ ANTHROPIC_API_KEY: "anth-key" }),
    ).toBe("anthropic");
  });

  it("falls back to openai when only OPENAI_API_KEY is set", () => {
    expect(inferProviderFromEnvironment({ OPENAI_API_KEY: "oa-key" })).toBe(
      "openai",
    );
  });

  describe("bedrock inference", () => {
    it("returns bedrock when AWS access key + secret key are both set", () => {
      expect(
        inferProviderFromEnvironment({
          AWS_ACCESS_KEY_ID: "AKIA...",
          AWS_SECRET_ACCESS_KEY: "secret",
        }),
      ).toBe("bedrock");
    });

    it("returns bedrock when only AWS_PROFILE is set", () => {
      expect(inferProviderFromEnvironment({ AWS_PROFILE: "default" })).toBe(
        "bedrock",
      );
    });

    it("does NOT return bedrock when only AWS_ACCESS_KEY_ID is set without secret", () => {
      expect(
        inferProviderFromEnvironment({ AWS_ACCESS_KEY_ID: "AKIA..." }),
      ).toBeUndefined();
    });

    it("does NOT return bedrock when only AWS_SECRET_ACCESS_KEY is set without access key", () => {
      expect(
        inferProviderFromEnvironment({ AWS_SECRET_ACCESS_KEY: "secret" }),
      ).toBeUndefined();
    });
  });

  describe("azure inference", () => {
    it("returns azure when AZURE_API_KEY + AZURE_RESOURCE_NAME are both set", () => {
      expect(
        inferProviderFromEnvironment({
          AZURE_API_KEY: "az-key",
          AZURE_RESOURCE_NAME: "my-resource",
        }),
      ).toBe("azure");
    });

    it("does NOT return azure when only AZURE_API_KEY is set", () => {
      expect(
        inferProviderFromEnvironment({ AZURE_API_KEY: "az-key" }),
      ).toBeUndefined();
    });

    it("does NOT return azure when only AZURE_RESOURCE_NAME is set", () => {
      expect(
        inferProviderFromEnvironment({ AZURE_RESOURCE_NAME: "my-resource" }),
      ).toBeUndefined();
    });
  });
});

describe("getDefaultModelForProviderType", () => {
  it("returns the configured default for known provider types", () => {
    expect(getDefaultModelForProviderType("openai")).toBe("gpt-4o-mini");
    expect(getDefaultModelForProviderType("anthropic")).toBe(
      "claude-sonnet-4-20250514",
    );
    expect(getDefaultModelForProviderType("google")).toBe(
      "gemini-flash-latest",
    );
    expect(getDefaultModelForProviderType("ollama")).toBe("gemma3");
  });

  it("returns undefined for unknown provider types", () => {
    expect(getDefaultModelForProviderType("nonsense")).toBeUndefined();
  });
});

describe("getDefaultModelForProvider", () => {
  it("returns provider-specific model when set", () => {
    expect(
      getDefaultModelForProvider({ type: "openai", model: "gpt-4o" }),
    ).toBe("gpt-4o");
  });

  it("falls back to provider-type default when model is not set", () => {
    expect(getDefaultModelForProvider({ type: "openai" })).toBe("gpt-4o-mini");
  });

  it("returns undefined for an undefined config", () => {
    expect(getDefaultModelForProvider(undefined)).toBeUndefined();
  });
});

describe("detectLocalProvider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Replace fetch per test
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns 'ollama' when the local /api/tags endpoint responds OK", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true } as Response) as unknown as typeof fetch;

    expect(await detectLocalProvider()).toBe("ollama");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/tags",
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it("returns undefined when the endpoint responds non-OK", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false } as Response) as unknown as typeof fetch;
    expect(await detectLocalProvider()).toBeUndefined();
  });

  it("returns undefined when the endpoint is unreachable (fetch throws)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(
        new TypeError("ECONNREFUSED"),
      ) as unknown as typeof fetch;
    expect(await detectLocalProvider()).toBeUndefined();
  });

  it("returns undefined when the request times out (AbortError)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("aborted"), { name: "AbortError" }),
      ) as unknown as typeof fetch;
    expect(await detectLocalProvider()).toBeUndefined();
  });
});
