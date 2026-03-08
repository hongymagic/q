import { describe, expect, it } from "vitest";
import { formatErrorDiagnostics, formatStderrMessage } from "../src/logging.ts";

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

describe("formatErrorDiagnostics", () => {
  it("redacts sensitive fields in error properties", () => {
    const error = new Error("Test error") as Error & { config?: unknown };
    error.config = {
      headers: {
        Authorization: "Bearer super-secret-token",
        "X-API-Key": "my-api-key",
      },
      url: "https://api.example.com",
    };

    const output = formatErrorDiagnostics(error);

    expect(output).toContain("name: Error");
    expect(output).toContain("message: Test error");
    expect(output).toContain("https://api.example.com");
    expect(output).not.toContain("super-secret-token");
    expect(output).not.toContain("my-api-key");
  });

  it("redacts sensitive fields in nested cause objects", () => {
    const rootError = new Error("Root error");
    const causeError = new Error("Cause error") as Error & {
      requestDetails?: unknown;
    };

    causeError.requestDetails = {
      password: "my-password",
      token: "secret-token",
    };
    rootError.cause = causeError;

    const output = formatErrorDiagnostics(rootError);

    expect(output).toContain("name: Error");
    expect(output).toContain("message: Root error");
    expect(output).toContain("cause:");
    expect(output).toContain("message: Cause error");
    expect(output).not.toContain("my-password");
    expect(output).not.toContain("secret-token");
  });

  it("redacts sensitive fields in arrays", () => {
    const error = new Error("Test array error") as Error & {
      identities?: unknown;
    };
    error.identities = [
      { id: 1, token: "first-secret" },
      { id: 2, API_KEY: "second-secret" },
    ];

    const output = formatErrorDiagnostics(error);
    expect(output).toContain("name: Error");
    expect(output).toContain("message: Test array error");
    expect(output).toContain('"id": 1');
    expect(output).not.toContain("first-secret");
    expect(output).not.toContain("second-secret");
    expect(output).toContain("[REDACTED]");
  });

  it("does not redact safe keys containing token/key substrings", () => {
    const error = new Error("Test safe keys") as Error & { metrics?: unknown };
    error.metrics = {
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
      monkey: "banana",
    };

    const output = formatErrorDiagnostics(error);
    expect(output).toContain('"promptTokens": 100');
    expect(output).toContain('"completionTokens": 200');
    expect(output).toContain('"totalTokens": 300');
    expect(output).toContain('"monkey": "banana"');
  });
});
