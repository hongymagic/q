import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { env } from "../env.ts";
import { ConfigParseError, ConfigValidationError } from "../errors.ts";
import { logWarning } from "../logging.ts";
import {
  detectLocalProvider,
  getBuiltInProviderConfigs,
  getDefaultModelForProvider,
  getProviderStatusSummary,
  inferProviderFromEnvironment,
} from "../provider-catalog.ts";

export const ProviderType = z.enum([
  "openai",
  "anthropic",
  "openai_compatible",
  "ollama",
  "portkey",
  "google",
  "groq",
  "azure",
  "bedrock",
]);
export type ProviderType = z.infer<typeof ProviderType>;

export const ProviderConfigSchema = z.object({
  type: ProviderType,
  model: z.string().optional(),
  api_key_env: z.string().optional(),
  base_url: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  // Portkey fields
  provider_slug: z.string().optional(),
  provider_api_key_env: z.string().optional(),
  // Azure fields
  resource_name: z.string().optional(),
  api_version: z.string().optional(),
  // Bedrock fields
  region: z.string().optional(),
  access_key_env: z.string().optional(),
  secret_key_env: z.string().optional(),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const DefaultConfigSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  copy: z.boolean().optional(),
});
export type DefaultConfig = z.infer<typeof DefaultConfigSchema>;

export const ConfigSchema = z.object({
  default: DefaultConfigSchema,
  providers: z.record(z.string(), ProviderConfigSchema),
});
export type ConfigData = z.infer<typeof ConfigSchema>;

const PartialConfigSchema = z
  .object({
    default: DefaultConfigSchema.partial().optional(),
    providers: z.record(z.string(), ProviderConfigSchema).optional(),
  })
  .optional();
type PartialConfig = z.infer<typeof PartialConfigSchema>;

export function getXdgConfigPath(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return join(xdgConfigHome, "q", "config.toml");
  }
  return join(process.env.HOME ?? "", ".config", "q", "config.toml");
}

export function getXdgConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return join(xdgConfigHome, "q");
  }
  return join(process.env.HOME ?? "", ".config", "q");
}

export function getCwdConfigPath(): string {
  return join(process.cwd(), "config.toml");
}

export function getConfigPath(): string {
  return getXdgConfigPath();
}

export function getConfigDir(): string {
  return getXdgConfigDir();
}

export class Config {
  readonly default: { provider?: string; model?: string; copy?: boolean };
  readonly providers: Record<string, ProviderConfig>;

  private constructor(data: ConfigData) {
    this.default = data.default;
    this.providers = data.providers;
  }

  static async load(): Promise<Config> {
    const [xdgConfig, cwdConfig] = await Promise.all([
      Config.tryLoadFile(getXdgConfigPath()),
      Config.tryLoadFile(getCwdConfigPath()),
    ]);

    const mergedDefault = {
      ...(xdgConfig?.default ?? {}),
      ...(cwdConfig?.default ?? {}),
    };
    const mergedProviders = {
      ...getBuiltInProviderConfigs(),
      ...(xdgConfig?.providers ?? {}),
      ...(cwdConfig?.providers ?? {}),
    };

    const inferredProvider = await Config.inferDefaultProvider(mergedDefault);
    const providerForDefaultModel =
      env.Q_PROVIDER ?? mergedDefault.provider ?? inferredProvider;
    const inferredModel = providerForDefaultModel
      ? getDefaultModelForProvider(mergedProviders[providerForDefaultModel])
      : undefined;

    const finalDefault = {
      ...(inferredProvider ? { provider: inferredProvider } : {}),
      ...(inferredModel ? { model: inferredModel } : {}),
      ...mergedDefault,
      ...(env.Q_PROVIDER ? { provider: env.Q_PROVIDER } : {}),
      ...(env.Q_MODEL ? { model: env.Q_MODEL } : {}),
      ...(env.Q_COPY !== undefined ? { copy: env.Q_COPY } : {}),
    };

    const merged = {
      default: finalDefault,
      providers: mergedProviders,
    };

    const result = ConfigSchema.safeParse(merged);
    if (!result.success) {
      throw new ConfigValidationError(formatZodErrors(result.error));
    }

    const interpolated = Config.interpolateEnvVars(result.data);
    return new Config(interpolated);
  }

  private static async inferDefaultProvider(
    mergedDefault: Partial<DefaultConfig>,
  ): Promise<string | undefined> {
    if (mergedDefault.provider || env.Q_PROVIDER) {
      return undefined;
    }

    const envProvider = inferProviderFromEnvironment();
    if (envProvider) {
      return envProvider;
    }

    return detectLocalProvider();
  }

  getProvider(name?: string): ProviderConfig {
    const providerName = name ?? this.default.provider;
    if (!providerName) {
      throw new ConfigValidationError(
        "No default provider is configured. Set Q_PROVIDER, pass --provider, install Ollama, set an API key, or run 'q config init'.",
      );
    }
    const provider = this.providers[providerName];
    if (!provider) {
      throw new ConfigValidationError(
        `Provider '${providerName}' not found in config.\n` +
          `Available providers: ${Object.keys(this.providers).join(", ")}`,
      );
    }
    return provider;
  }

  private static async tryLoadFile(
    path: string,
  ): Promise<PartialConfig | undefined> {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return undefined;
    }

    try {
      const content = await file.text();
      const parsed = Bun.TOML.parse(content);
      const result = PartialConfigSchema.safeParse(parsed);
      if (!result.success) {
        throw new ConfigValidationError(
          `Invalid config at ${path}:\n${formatZodErrors(result.error)}`,
        );
      }
      return result.data;
    } catch (err) {
      if (err instanceof ConfigValidationError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new ConfigParseError(path, message);
    }
  }

  private static interpolateEnvVars(config: ConfigData): ConfigData {
    const result = structuredClone(config);

    for (const [providerName, provider] of Object.entries(result.providers)) {
      if (provider.base_url) {
        provider.base_url = Config.interpolate(provider.base_url);
        Config.warnIfInsecureUrl(provider.base_url, providerName);
      }

      if (provider.provider_slug) {
        provider.provider_slug = Config.interpolate(provider.provider_slug);
      }

      if (provider.headers) {
        for (const [key, value] of Object.entries(provider.headers)) {
          provider.headers[key] = Config.interpolate(value);
        }
      }
    }

    return result;
  }

  private static warnIfInsecureUrl(url: string, providerName: string): void {
    try {
      const parsed = new URL(url);
      const isLocalhost =
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "::1" ||
        parsed.hostname.endsWith(".local");

      if (parsed.protocol === "http:" && !isLocalhost) {
        logWarning(
          `Provider '${providerName}' uses insecure HTTP URL: ${url}\nConsider using HTTPS for non-localhost connections.`,
        );
      }
    } catch {
      // Invalid URL will be caught elsewhere; ignore here
    }
  }

  private static interpolate(value: string): string {
    return interpolateValue(value);
  }
}

/**
 * Allowlist of environment variables permitted for interpolation.
 * This prevents exfiltration of sensitive env vars via base_url or headers.
 */
const ALLOWED_INTERPOLATION_VARS = new Set([
  // Provider API keys
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "PORTKEY_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GROQ_API_KEY",
  "AZURE_API_KEY",
  // Provider base URLs
  "ANTHROPIC_BASE_URL",
  "OPENAI_BASE_URL",
  "PORTKEY_BASE_URL",
  // Portkey-specific
  "PORTKEY_PROVIDER",
  // Azure-specific
  "AZURE_RESOURCE_NAME",
  // AWS credentials (for Bedrock)
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_REGION",
  // Proxy settings
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  // Safe system vars
  "HOME",
  "USER",
  "HOSTNAME",
]);

/**
 * Interpolate environment variables in a string value.
 * Only allowlisted variables are permitted for security.
 * @internal Exported for testing only
 */
export function interpolateValue(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName: string) => {
    // Security: Only allow specific env vars to prevent exfiltration
    // of sensitive environment variables via base_url or headers
    if (!ALLOWED_INTERPOLATION_VARS.has(varName)) {
      const allowedList = Array.from(ALLOWED_INTERPOLATION_VARS).join(", ");
      throw new ConfigValidationError(
        `Environment variable '${varName}' is not allowed for interpolation.\n` +
          `Allowed variables: ${allowedList}`,
      );
    }

    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw new ConfigValidationError(
        `Environment variable '${varName}' referenced in config but not set`,
      );
    }
    return envValue;
  });
}

export async function loadConfig(): Promise<Config> {
  return Config.load();
}

export interface ConfigLayer {
  source: string;
  path: string | null;
  found: boolean;
  data: Record<string, unknown> | null;
}

export interface DoctorReport {
  layers: ConfigLayer[];
  envOverrides: {
    variable: string;
    value: string | undefined;
    active: boolean;
  }[];
  providerIssues: { provider: string; issue: string }[];
  summary: "ok" | "warnings" | "errors";
}

export async function runConfigDoctor(): Promise<DoctorReport> {
  const xdgPath = getXdgConfigPath();
  const cwdPath = getCwdConfigPath();

  const xdgFile = Bun.file(xdgPath);
  const cwdFile = Bun.file(cwdPath);

  const [xdgExists, cwdExists] = await Promise.all([
    xdgFile.exists(),
    cwdFile.exists(),
  ]);
  const [xdgData, cwdData] = await Promise.all([
    xdgExists ? safeParseToml(xdgFile) : Promise.resolve(null),
    cwdExists ? safeParseToml(cwdFile) : Promise.resolve(null),
  ]);

  const layers: ConfigLayer[] = [
    {
      source: "XDG config",
      path: xdgPath,
      found: xdgExists,
      data: xdgData,
    },
    {
      source: "CWD config",
      path: cwdPath,
      found: cwdExists,
      data: cwdData,
    },
  ];

  const envOverrides = [
    {
      variable: "Q_PROVIDER",
      value: process.env.Q_PROVIDER,
      active: Boolean(process.env.Q_PROVIDER),
    },
    {
      variable: "Q_MODEL",
      value: process.env.Q_MODEL,
      active: Boolean(process.env.Q_MODEL),
    },
    {
      variable: "Q_COPY",
      value: process.env.Q_COPY,
      active: process.env.Q_COPY !== undefined && process.env.Q_COPY !== "",
    },
  ];

  const providerIssues: DoctorReport["providerIssues"] = [];
  const configuredProviderNames = new Set<string>([
    ...Object.keys(
      ((xdgData ?? {}) as { providers?: Record<string, unknown> }).providers ??
        {},
    ),
    ...Object.keys(
      ((cwdData ?? {}) as { providers?: Record<string, unknown> }).providers ??
        {},
    ),
  ]);

  // Try loading the full config to check providers
  try {
    const config = await Config.load();

    if (!xdgExists && !cwdExists) {
      if (config.default.provider) {
        providerIssues.push({
          provider: "(setup)",
          issue: `No config file found. Using built-in defaults with provider '${config.default.provider}'.`,
        });
      } else {
        providerIssues.push({
          provider: "(setup)",
          issue:
            "No config file or detected provider found. Install Ollama, set GEMINI_API_KEY or GROQ_API_KEY, or run 'q config init'.",
        });
      }
    }

    if (config.default.provider) {
      configuredProviderNames.add(config.default.provider);
    }

    if (configuredProviderNames.size === 0 && config.default.provider) {
      configuredProviderNames.add(config.default.provider);
    }

    for (const name of configuredProviderNames) {
      const providerConfig = config.providers[name];
      if (!providerConfig) {
        providerIssues.push({
          provider: name,
          issue: "Provider is not available.",
        });
        continue;
      }

      const { issues } = getProviderStatusSummary(providerConfig);
      for (const issue of issues) {
        providerIssues.push({ provider: name, issue });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    providerIssues.push({ provider: "(config)", issue: message });
  }

  const configLoadFailed = providerIssues.some(
    (i) => i.provider === "(config)",
  );
  const hasErrors = configLoadFailed;
  const hasWarnings = providerIssues.length > 0;

  return {
    layers,
    envOverrides,
    providerIssues,
    summary: hasErrors ? "errors" : hasWarnings ? "warnings" : "ok",
  };
}

async function safeParseToml(
  file: ReturnType<typeof Bun.file>,
): Promise<Record<string, unknown> | null> {
  try {
    const content = await file.text();
    return Bun.TOML.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = ["Config Doctor", ""];

  // Config layers
  lines.push("Config layers:");
  for (const layer of report.layers) {
    const status = layer.found ? "found" : "not found";
    lines.push(`  ${layer.source}: ${layer.path} (${status})`);
    if (layer.found && layer.data) {
      const keys = Object.keys(layer.data);
      lines.push(`    Sections: ${keys.join(", ") || "(empty)"}`);
    }
  }
  lines.push("");

  // Env overrides
  lines.push("Environment overrides:");
  const activeOverrides = report.envOverrides.filter((e) => e.active);
  if (activeOverrides.length === 0) {
    lines.push("  (none)");
  } else {
    for (const override of activeOverrides) {
      lines.push(`  ${override.variable} = ${override.value}`);
    }
  }
  lines.push("");

  // Provider issues
  if (report.providerIssues.length > 0) {
    lines.push("Issues:");
    for (const issue of report.providerIssues) {
      lines.push(`  [${issue.provider}] ${issue.issue}`);
    }
  } else {
    lines.push("Issues: none");
  }
  lines.push("");

  // Summary
  const summaryMap = {
    ok: "All checks passed.",
    warnings: "Some warnings detected (see issues above).",
    errors: "Configuration errors found (see issues above).",
  };
  lines.push(`Status: ${summaryMap[report.summary]}`);

  return lines.join("\n");
}

export function formatZodErrors(error: z.ZodError): string {
  return error.issues
    .map((e) => {
      const path = e.path.join(".");
      return path ? `  - ${path}: ${e.message}` : `  - ${e.message}`;
    })
    .join("\n");
}

export const EXAMPLE_CONFIG = `# q configuration file
# Location: ~/.config/q/config.toml
#
# This file is optional. q can run with built-in defaults:
#   - install Ollama for local usage, or
#   - set GEMINI_API_KEY / GROQ_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY
#
# Add settings here only when you want to pin behaviour or customise providers.

[default]
# provider = "google"          # Optional: q auto-detects a provider when possible
# model = "gemini-2.5-flash"   # Optional: q uses provider defaults when omitted
# copy = true                   # Optional: always copy answer to clipboard

# Local-first example
# [providers.ollama]
# type = "ollama"
# # base_url = "http://localhost:11434"
# # model = "gemma3"

# Free cloud example (Google Gemini)
# [providers.google]
# type = "google"
# # api_key_env = "GEMINI_API_KEY"
# # model = "gemini-2.5-flash"

# Free cloud example (Groq)
# [providers.groq]
# type = "groq"
# # api_key_env = "GROQ_API_KEY"
# # model = "openai/gpt-oss-20b"

# Advanced examples
# [providers.work_openai]
# type = "openai"
# api_key_env = "OPENAI_API_KEY"
# model = "gpt-4o-mini"

# [providers.local]
# type = "openai_compatible"
# base_url = "http://localhost:1234/v1"
# # api_key_env = "LOCAL_API_KEY"

# [providers.azure]
# type = "azure"
# resource_name = "my-azure-resource"
# api_key_env = "AZURE_API_KEY"
# # model = "gpt-4o-deployment"

# [providers.bedrock]
# type = "bedrock"
# region = "us-east-1"
# # model = "us.anthropic.claude-sonnet-4-20250514-v1:0"

# [providers.portkey]
# type = "portkey"
# base_url = "https://api.portkey.ai/v1"
# provider_slug = "openai"
# api_key_env = "PORTKEY_API_KEY"
`;

export async function initConfig(): Promise<string> {
  const configPath = getXdgConfigPath();
  const configDir = getXdgConfigDir();

  await mkdir(configDir, { recursive: true, mode: 0o700 });

  const file = Bun.file(configPath);
  if (await file.exists()) {
    return `Config already exists at: ${configPath}`;
  }

  await writeFile(configPath, EXAMPLE_CONFIG, {
    encoding: "utf8",
    mode: 0o600,
  });
  return `Created config file at: ${configPath}`;
}
