/**
 * Type-safe environment variables for the q CLI
 *
 * Uses @t3-oss/env-core for validation and type safety.
 * These env vars are validated at import time, providing early failure.
 */
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Config overrides (optional - can override config file settings)
    Q_PROVIDER: z.string().optional(),
    Q_MODEL: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
