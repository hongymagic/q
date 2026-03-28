import { describe, expect, it } from "vitest";
import {
  ConfigNotFoundError,
  ConfigParseError,
  ConfigValidationError,
  getUserErrorMessage,
  MissingApiKeyError,
  ModelNotConfiguredError,
  ProviderError,
  ProviderNotFoundError,
  SetupRequiredError,
  shouldWriteFailureLog,
  UsageError,
} from "../src/errors.ts";

describe("getUserErrorMessage", () => {
  it("formats missing config errors concisely", () => {
    expect(
      getUserErrorMessage(new ConfigNotFoundError("/tmp/config.toml")),
    ).toBe("Config file not found. Run 'q config init'.");
  });

  it("formats config parse errors concisely", () => {
    expect(
      getUserErrorMessage(new ConfigParseError("/tmp/config.toml", "bad toml")),
    ).toBe("Could not parse config file.");
  });

  it("formats config validation errors concisely", () => {
    expect(getUserErrorMessage(new ConfigValidationError("bad config"))).toBe(
      "Configuration is invalid. Check 'q config path'.",
    );
  });

  it("formats missing API key errors concisely", () => {
    expect(
      getUserErrorMessage(
        new MissingApiKeyError("ANTHROPIC_API_KEY", "anthropic"),
      ),
    ).toBe("Missing API key. Set ANTHROPIC_API_KEY.");
  });

  it("formats missing model errors concisely", () => {
    expect(getUserErrorMessage(new ModelNotConfiguredError("local"))).toBe(
      "No model configured for provider 'local'. Set --model, Q_MODEL, provider.model, or default.model.",
    );
  });

  it("formats setup guidance errors concisely", () => {
    expect(getUserErrorMessage(new SetupRequiredError())).toBe(
      "Setup required. Install Ollama, set GEMINI_API_KEY or GROQ_API_KEY, or run 'q config init'.",
    );
  });

  it("formats provider lookup errors concisely", () => {
    expect(getUserErrorMessage(new ProviderNotFoundError("openai"))).toBe(
      "Provider 'openai' is not configured.",
    );
  });

  it("formats provider failures concisely", () => {
    expect(
      getUserErrorMessage(new ProviderError("AI request failed: timeout")),
    ).toBe("AI request failed: request timed out.");
  });

  it("prefers nested connection codes for provider failures", () => {
    expect(
      getUserErrorMessage(
        new ProviderError("AI request failed: Failed after 3 attempts.", {
          errors: [
            {
              message: "Cannot connect to API: Unable to connect.",
              cause: { code: "ConnectionRefused" },
            },
          ],
        }),
      ),
    ).toBe(
      "AI request failed: could not connect to provider (connection refused).",
    );
  });

  it("maps provider status codes to direct messages", () => {
    expect(
      getUserErrorMessage(
        new ProviderError("AI request failed: 429", { statusCode: 429 }),
      ),
    ).toBe("AI request failed: rate limit exceeded.");
  });

  it("uses first line for usage errors", () => {
    expect(
      getUserErrorMessage(new UsageError("Unknown option\nRun q --help")),
    ).toBe("Unknown option");
  });

  it("falls back to a generic message for unexpected errors", () => {
    expect(getUserErrorMessage(new Error("boom"))).toBe("Unexpected error.");
    expect(getUserErrorMessage("boom")).toBe("Unexpected error.");
  });
});

describe("shouldWriteFailureLog", () => {
  it("skips usage errors", () => {
    expect(shouldWriteFailureLog(new UsageError("Unknown option"))).toBe(false);
  });

  it("writes logs for config errors", () => {
    expect(
      shouldWriteFailureLog(new ConfigNotFoundError("/tmp/config.toml")),
    ).toBe(true);
  });

  it("writes logs for unexpected errors", () => {
    expect(shouldWriteFailureLog(new Error("boom"))).toBe(true);
  });
});
