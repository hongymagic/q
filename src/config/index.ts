import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { env } from "../env.ts";
import {
  ConfigNotFoundError,
  ConfigParseError,
  ConfigValidationError,
} from "../errors.ts";

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
  provider: z.string(),
  model: z.string(),
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
  readonly default: { provider: string; model: string };
  readonly providers: Record<string, ProviderConfig>;

  private constructor(data: ConfigData) {
    this.default = data.default;
    this.providers = data.providers;
  }

  static async load(): Promise<Config> {
    const xdgConfig = await Config.tryLoadFile(getXdgConfigPath());
    const cwdConfig = await Config.tryLoadFile(getCwdConfigPath());

    if (!xdgConfig && !cwdConfig) {
      throw new ConfigNotFoundError(getXdgConfigPath());
    }

    const mergedDefault = {
      ...(xdgConfig?.default ?? {}),
      ...(cwdConfig?.default ?? {}),
    };
    const mergedProviders = {
      ...(xdgConfig?.providers ?? {}),
      ...(cwdConfig?.providers ?? {}),
    };

    const finalDefault = {
      ...mergedDefault,
      ...(env.Q_PROVIDER ? { provider: env.Q_PROVIDER } : {}),
      ...(env.Q_MODEL ? { model: env.Q_MODEL } : {}),
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

  getProvider(name?: string): ProviderConfig {
    const providerName = name ?? this.default.provider;
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

    for (const [, provider] of Object.entries(result.providers)) {
      if (provider.base_url) {
        provider.base_url = Config.interpolate(provider.base_url);
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
# Config resolution order (later overrides earlier):
#   1. This file (XDG_CONFIG_HOME/q/config.toml or ~/.config/q/config.toml)
#   2. ./config.toml in current directory (project-specific)
#   3. Environment variables: Q_PROVIDER, Q_MODEL

[default]
provider = "anthropic"
model = "claude-sonnet-4-20250514"

[providers.anthropic]
type = "anthropic"
api_key_env = "ANTHROPIC_API_KEY"

[providers.openai]
type = "openai"
api_key_env = "OPENAI_API_KEY"

# Example: OpenAI-compatible provider (e.g., local LLM via LM Studio)
# [providers.local]
# type = "openai_compatible"
# base_url = "http://localhost:1234/v1"
# api_key_env = "LOCAL_API_KEY"

# Example: Portkey Gateway
# [providers.portkey_internal]
# type = "portkey"
# base_url = "https://your-portkey-gateway.internal/v1"
# provider_slug = "@your-org/bedrock-provider"
# api_key_env = "PORTKEY_API_KEY"
# provider_api_key_env = "PROVIDER_API_KEY"
# headers = { "x-portkey-trace-id" = "\${HOSTNAME}" }  # Only allowlisted env vars

# Example: Ollama (local models)
# [providers.ollama]
# type = "ollama"
# base_url = "http://localhost:11434"

# Example: Google Gemini
# [providers.google]
# type = "google"
# api_key_env = "GOOGLE_GENERATIVE_AI_API_KEY"
# # Models: gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash

# Example: Groq (ultra-fast inference)
# [providers.groq]
# type = "groq"
# api_key_env = "GROQ_API_KEY"
# # Models: llama-3.3-70b-versatile, qwen-qwq-32b, deepseek-r1-distill-llama-70b

# Example: Azure OpenAI
# [providers.azure]
# type = "azure"
# resource_name = "my-azure-resource"  # Or use base_url instead
# api_key_env = "AZURE_API_KEY"
# api_version = "v1"  # Optional, defaults to v1
# # Model = deployment name (e.g., "gpt-4o-deployment")

# Example: AWS Bedrock
# [providers.bedrock]
# type = "bedrock"
# region = "us-east-1"  # Optional, defaults to AWS_REGION env var
# # Uses standard AWS env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
# # Models: anthropic.claude-3-5-sonnet-20241022-v2:0, us.amazon.nova-pro-v1:0
`;

export async function initConfig(): Promise<string> {
  const configPath = getXdgConfigPath();
  const configDir = getXdgConfigDir();

  await mkdir(configDir, { recursive: true });

  const file = Bun.file(configPath);
  if (await file.exists()) {
    return `Config already exists at: ${configPath}`;
  }

  await Bun.write(configPath, EXAMPLE_CONFIG);
  return `Created config file at: ${configPath}`;
}
