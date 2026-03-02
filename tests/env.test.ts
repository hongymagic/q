import { afterEach, describe, expect, it, vi } from "vitest";

describe("env module", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("parses Q_PROVIDER as string", async () => {
    process.env.Q_PROVIDER = "openai";
    const { env } = await import("../src/env.ts");
    expect(env.Q_PROVIDER).toBe("openai");
  });

  it("parses Q_MODEL as string", async () => {
    process.env.Q_MODEL = "gpt-4o";
    const { env } = await import("../src/env.ts");
    expect(env.Q_MODEL).toBe("gpt-4o");
  });

  it("parses Q_COPY 'true' as boolean true", async () => {
    process.env.Q_COPY = "true";
    const { env } = await import("../src/env.ts");
    expect(env.Q_COPY).toBe(true);
  });

  it("parses Q_COPY '1' as boolean true", async () => {
    process.env.Q_COPY = "1";
    const { env } = await import("../src/env.ts");
    expect(env.Q_COPY).toBe(true);
  });

  it("parses Q_COPY 'false' as boolean false", async () => {
    process.env.Q_COPY = "false";
    const { env } = await import("../src/env.ts");
    expect(env.Q_COPY).toBe(false);
  });

  it("parses Q_COPY '0' as boolean false", async () => {
    process.env.Q_COPY = "0";
    const { env } = await import("../src/env.ts");
    expect(env.Q_COPY).toBe(false);
  });

  it("treats empty Q_COPY as undefined", async () => {
    process.env.Q_COPY = "";
    const { env } = await import("../src/env.ts");
    expect(env.Q_COPY).toBeUndefined();
  });

  it("leaves Q_PROVIDER undefined when not set", async () => {
    delete process.env.Q_PROVIDER;
    const { env } = await import("../src/env.ts");
    expect(env.Q_PROVIDER).toBeUndefined();
  });

  it("leaves Q_MODEL undefined when not set", async () => {
    delete process.env.Q_MODEL;
    const { env } = await import("../src/env.ts");
    expect(env.Q_MODEL).toBeUndefined();
  });
});
