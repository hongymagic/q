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
  it("redacts sensitive fields in nested objects", () => {
    const diagnostics = formatErrorDiagnostics({
      password: "hunter2",
      request: {
        headers: {
          Authorization: "secret-token",
        },
        api_key: "abcd1234",
        safe: "value",
      },
    });

    expect(diagnostics).toContain('"password": "********"');
    expect(diagnostics).toContain('"Authorization": "********"');
    expect(diagnostics).toContain('"api_key": "********"');
    expect(diagnostics).toContain('"safe": "value"');
    expect(diagnostics).not.toContain("hunter2");
    expect(diagnostics).not.toContain("secret-token");
    expect(diagnostics).not.toContain("abcd1234");
  });

  it("redacts sensitive fields on error properties and causes", () => {
    const error = Object.assign(
      new Error("boom", {
        cause: {
          nested_key: "cause-secret",
          detail: "provider error",
        },
      }),
      {
        token: "topsecret",
        metadata: {
          password: "letmein",
          safe: true,
        },
      },
    );

    const diagnostics = formatErrorDiagnostics(error);

    expect(diagnostics).toContain("name: Error");
    expect(diagnostics).toContain("message: boom");
    expect(diagnostics).toContain("token: ********");
    expect(diagnostics).toContain('"password": "********"');
    expect(diagnostics).toContain('"nested_key": "********"');
    expect(diagnostics).toContain('"detail": "provider error"');
    expect(diagnostics).not.toContain("topsecret");
    expect(diagnostics).not.toContain("letmein");
    expect(diagnostics).not.toContain("cause-secret");
  });
});
