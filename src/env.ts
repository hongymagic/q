import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const booleanString = z
  .string()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    const lower = val.toLowerCase();
    if (lower === "true" || lower === "1") return true;
    if (lower === "false" || lower === "0") return false;
    throw new Error(
      `Invalid Q_COPY value: '${val}'. Use 'true', 'false', '1', or '0'.`,
    );
  });

export const env = createEnv({
  server: {
    Q_PROVIDER: z.string().optional(),
    Q_MODEL: z.string().optional(),
    Q_COPY: booleanString,
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
