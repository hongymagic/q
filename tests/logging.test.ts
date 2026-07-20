import { readFile, rm } from "node:fs/promises";
import { afterAll, describe, expect, it } from "vitest";
import {
  configureLogging,
  formatErrorDiagnostics,
  formatStderrMessage,
  getFailureLogDir,
  updateLogContext,
  writeFailureLog,
} from "../src/logging.ts";

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

  it("omits requestHeaders and responseHeaders from error diagnostics", () => {
    const error = new Error("API error");
    Object.assign(error, {
      requestHeaders: { "x-api-key": "secret-key" },
      responseHeaders: { "x-internal-id": "internal-val" },
      statusCode: 403,
    });

    const output = formatErrorDiagnostics(error);
    expect(output).not.toContain("secret-key");
    expect(output).not.toContain("internal-val");
    expect(output).not.toContain("requestHeaders");
    expect(output).not.toContain("responseHeaders");
    expect(output).toContain("statusCode");
    expect(output).toContain("403");
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

  it("redacts sensitive keys inside chained error.cause", () => {
    const innerError = new Error("upstream auth failure");
    Object.assign(innerError, {
      api_key: "sk-inner-secret-12345",
      Authorization: "Bearer inner-bearer",
      statusCode: 401,
    });

    const outerError = new Error("Request failed", { cause: innerError });
    Object.assign(outerError, { statusCode: 500 });

    const output = formatErrorDiagnostics(outerError);

    // Outer-level non-sensitive prop preserved
    expect(output).toContain("statusCode");
    expect(output).toContain("500");

    // Inner cause is included
    expect(output).toContain("upstream auth failure");
    expect(output).toContain("401");

    // Sensitive props from the inner cause are redacted, not leaked
    expect(output).not.toContain("sk-inner-secret-12345");
    expect(output).not.toContain("inner-bearer");
    expect(output).toContain("[REDACTED]");
  });

  it("redacts sensitive keys nested 2+ levels deep through cause chains", () => {
    const deepest = new Error("auth boundary");
    Object.assign(deepest, { api_key: "sk-deepest" });

    const middle = new Error("middleware error", { cause: deepest });
    Object.assign(middle, { auth_token: "bearer-middle" });

    const top = new Error("Top-level failure", { cause: middle });

    const output = formatErrorDiagnostics(top);

    expect(output).not.toContain("sk-deepest");
    expect(output).not.toContain("bearer-middle");
    expect(output).toContain("auth boundary");
    expect(output).toContain("middleware error");
  });
});

describe("writeFailureLog session context redaction", () => {
  const writtenLogPaths: string[] = [];

  afterAll(async () => {
    await Promise.all(writtenLogPaths.map((path) => rm(path, { force: true })));
    // Reset session context for other tests
    configureLogging({ debug: false });
  });

  it("redacts sensitive session context values in the failure log file", async () => {
    configureLogging({ debug: false });
    updateLogContext({
      provider: "anthropic",
      api_key: "sk-secret-12345",
      auth_token: "Bearer super-secret",
      Authorization: "Bearer top-secret",
    });

    const path = await writeFailureLog(new Error("boom"), "Failed");
    writtenLogPaths.push(path);

    expect(path.startsWith(getFailureLogDir())).toBe(true);

    const content = await readFile(path, "utf8");
    expect(content).toContain("provider: anthropic");
    expect(content).toContain("api_key: [REDACTED]");
    expect(content).toContain("auth_token: [REDACTED]");
    expect(content).toContain("Authorization: [REDACTED]");
    expect(content).not.toContain("sk-secret-12345");
    expect(content).not.toContain("super-secret");
    expect(content).not.toContain("top-secret");
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
