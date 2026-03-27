import { describe, expect, it } from "vitest";
import { formatErrorDiagnostics, formatStderrMessage } from "../src/logging.ts";

describe("formatErrorDiagnostics secret redaction", () => {
  it("omits requestBodyValues from error diagnostics", () => {
    const error = new Error("API error");
    Object.assign(error, {
      requestBodyValues: { prompt: "secret system prompt" },
      statusCode: 401,
    });

    const output = formatErrorDiagnostics(error);
    expect(output).not.toContain("secret system prompt");
    expect(output).not.toContain("requestBodyValues");
    expect(output).toContain("statusCode");
    expect(output).toContain("401");
  });

  it("omits responseBody from error diagnostics", () => {
    const error = new Error("Server error");
    Object.assign(error, {
      responseBody: '{"error":"internal","trace":"secret-trace"}',
      statusCode: 500,
    });

    const output = formatErrorDiagnostics(error);
    expect(output).not.toContain("secret-trace");
    expect(output).not.toContain("responseBody");
    expect(output).toContain("statusCode");
  });

  it("redacts properties with sensitive key names", () => {
    const error = new Error("Auth failed");
    Object.assign(error, {
      api_key: "sk-secret-12345",
      auth_token: "Bearer super-secret",
      apiKey: "camel-case-secret",
      statusCode: 403,
    });

    const output = formatErrorDiagnostics(error);
    expect(output).not.toContain("sk-secret-12345");
    expect(output).not.toContain("super-secret");
    expect(output).not.toContain("camel-case-secret");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("statusCode");
    expect(output).toContain("403");
  });

  it("redacts sensitive keys inside nested objects", () => {
    const error = new Error("Request failed");
    Object.assign(error, {
      headers: {
        Authorization: "Bearer sk-secret-key",
        "Content-Type": "application/json",
        "x-api-key": "secret-key-value",
        "x-portkey-api-key": "very-long-secret-key-that-was-partially-masked",
        access_token: "short-token",
      },
    });

    const output = formatErrorDiagnostics(error);
    expect(output).not.toContain("sk-secret-key");
    expect(output).not.toContain("secret-key-value");
    expect(output).not.toContain(
      "very-long-secret-key-that-was-partially-masked",
    );
    expect(output).not.toContain("short-token");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("application/json");
  });

  it("preserves non-sensitive properties", () => {
    const error = new Error("Something broke");
    Object.assign(error, {
      statusCode: 500,
      url: "https://api.example.com/v1/chat",
      retryCount: 3,
    });

    const output = formatErrorDiagnostics(error);
    expect(output).toContain("statusCode");
    expect(output).toContain("500");
    expect(output).toContain("url");
    expect(output).toContain("https://api.example.com/v1/chat");
    expect(output).toContain("retryCount");
    expect(output).toContain("3");
  });
});

describe("formatStderrMessage", () => {
  it("keeps plain text when colour is disabled", () => {
    expect(formatStderrMessage("Error: Boom", false)).toBe("Error: Boom");
    expect(formatStderrMessage("Warning: Careful", false)).toBe(
      "Warning: Careful",
    );
    expect(formatStderrMessage("[debug] hello", false)).toBe("[debug] hello");
    expect(formatStderrMessage("Full log: /tmp/q.log", false)).toBe(
      "Full log: /tmp/q.log",
    );
  });

  it("adds light colour when enabled", () => {
    const errorLine = formatStderrMessage("Error: Boom", true);
    const warningLine = formatStderrMessage("Warning: Careful", true);
    const debugLine = formatStderrMessage("[debug] hello", true);
    const logLine = formatStderrMessage("Full log: /tmp/q.log", true);

    expect(errorLine).toContain("\u001B[");
    expect(errorLine).toContain("Error:");
    expect(warningLine).toContain("\u001B[");
    expect(warningLine).toContain("Warning:");
    expect(debugLine).toContain("\u001B[");
    expect(debugLine).toContain("[debug]");
    expect(logLine).toContain("\u001B[");
    expect(logLine).toContain("Full log:");
    expect(logLine).toContain("/tmp/q.log");
  });
});
