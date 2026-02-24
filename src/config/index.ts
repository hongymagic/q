/**
 * Configuration module for the q CLI
 *
 * Config resolution order (cascade merge, later overrides earlier):
 *   1. XDG config ($XDG_CONFIG_HOME/q/config.toml or ~/.config/q/config.toml)
 *   2. CWD config (./config.toml)
 *   3. Environment variables (Q_PROVIDER, Q_MODEL)
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { env } from "../env.ts";
import {
  ConfigNotFoundError,
  ConfigParseError,
  ConfigValidationError,
} from "../errors.ts";

// ============================================================================
// Schemas (Zod 4)
// ============================================================================

/**
 * Provider types supported by the CLI
 */
export const ProviderType = z.enum([
  "openai",
  "anthropic",
  "openai_compatible",
  "ollama",
  "portkey",
]);
export type ProviderType = z.infer<typeof ProviderType>;

/**
 * Provider configuration schema
 * Supports all provider types with optional portkey-specific fields
 */
export const ProviderConfigSchema = z.object({
  type: ProviderType,
  api_key_env: z.string().optional(),
  base_url: z.string().optional(),
  // Zod 4: z.record() requires two arguments
  headers: z.record(z.string(), z.string()).optional(),
  // Portkey-specific fields
  provider_slug: z.string().optional(), // Maps to x-portkey-provider header
  provider_api_key_env: z.string().optional(), // Maps to Authorization: Bearer header
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/**
 * Default configuration schema
 */
export const DefaultConfigSchema = z.object({
  provider: z.string(),
  model: z.string(),
});
export type DefaultConfig = z.infer<typeof DefaultConfigSchema>;

/**
 * Full config file schema
 */
export const ConfigSchema = z.object({
  default: DefaultConfigSchema,
  // Zod 4: z.record() requires two arguments
  providers: z.record(z.string(), ProviderConfigSchema),
});
export type ConfigData = z.infer<typeof ConfigSchema>;

/**
 * Partial config schema for merging (all fields optional)
 */
const PartialConfigSchema = z
  .object({
    default: DefaultConfigSchema.partial().optional(),
    providers: z.record(z.string(), ProviderConfigSchema).optional(),
  })
  .optional();
type PartialConfig = z.infer<typeof PartialConfigSchema>;

// ============================================================================
// Path utilities
// ============================================================================

/**
 * Get the XDG config path
 */
export function getXdgConfigPath(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return join(xdgConfigHome, "q", "config.toml");
  }
  return join(process.env.HOME ?? "", ".config", "q", "config.toml");
}

/**
 * Get the XDG config directory
 */
export function getXdgConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return join(xdgConfigHome, "q");
  }
  return join(process.env.HOME ?? "", ".config", "q");
}

/**
 * Get the CWD config path
 */
export function getCwdConfigPath(): string {
  return join(process.cwd(), "config.toml");
}

/**
 * Get the resolved config path (for display purposes)
 * Returns the first existing config path found
 */
export function getConfigPath(): string {
  // Return XDG path as the "canonical" path for display
  return getXdgConfigPath();
}

/**
 * Alias for getXdgConfigDir for backwards compatibility
 */
export function getConfigDir(): string {
  return getXdgConfigDir();
}

// ============================================================================
// Config Class
// ============================================================================

/**
 * Configuration manager for the q CLI
 *
 * Handles cascade loading: XDG → CWD → ENV
 * Validates config and exits early on errors
 */
export class Config {
  readonly default: { provider: string; model: string };
  readonly providers: Record<string, ProviderConfig>;

  private constructor(data: ConfigData) {
    this.default = data.default;
    this.providers = data.providers;
  }

  /**
   * Load configuration with cascade: XDG → CWD → ENV
   * Validates and throws early on errors
   */
  static async load(): Promise<Config> {
    // 1. Load XDG config (global)
    const xdgConfig = await Config.tryLoadFile(getXdgConfigPath());

    // 2. Load CWD config (project-specific)
    const cwdConfig = await Config.tryLoadFile(getCwdConfigPath());

    // If no config files exist, throw helpful error
    if (!xdgConfig && !cwdConfig) {
      throw new ConfigNotFoundError(getXdgConfigPath());
    }

    // 3. Merge: CWD overrides XDG
    const mergedDefault = {
      ...(xdgConfig?.default ?? {}),
      ...(cwdConfig?.default ?? {}),
    };
    const mergedProviders = {
      ...(xdgConfig?.providers ?? {}),
      ...(cwdConfig?.providers ?? {}),
    };

    // 4. Apply ENV overrides
    const finalDefault = {
      ...mergedDefault,
      ...(env.Q_PROVIDER ? { provider: env.Q_PROVIDER } : {}),
      ...(env.Q_MODEL ? { model: env.Q_MODEL } : {}),
    };

    const merged = {
      default: finalDefault,
      providers: mergedProviders,
    };

    // 5. Validate final merged config
    const result = ConfigSchema.safeParse(merged);
    if (!result.success) {
      throw new ConfigValidationError(formatZodErrors(result.error));
    }

    // 6. Interpolate env vars in specific fields
    const interpolated = Config.interpolateEnvVars(result.data);

    return new Config(interpolated);
  }

  /**
   * Get a provider config by name
   * @throws ProviderNotFoundError if provider doesn't exist
   */
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

  /**
   * Try to load a config file, returns undefined if not found
   */
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

  /**
   * Interpolate ${VAR_NAME} in specific config fields
   * Only interpolates: base_url, headers values, provider_slug
   */
  private static interpolateEnvVars(config: ConfigData): ConfigData {
    const result = structuredClone(config);

    for (const [, provider] of Object.entries(result.providers)) {
      // Interpolate base_url
      if (provider.base_url) {
        provider.base_url = Config.interpolate(provider.base_url);
      }

      // Interpolate provider_slug (Portkey-specific)
      if (provider.provider_slug) {
        provider.provider_slug = Config.interpolate(provider.provider_slug);
      }

      // Interpolate header values
      if (provider.headers) {
        for (const [key, value] of Object.entries(provider.headers)) {
          provider.headers[key] = Config.interpolate(value);
        }
      }
    }

    return result;
  }

  /**
   * Replace ${VAR_NAME} with environment variable value
   */
  private static interpolate(value: string): string {
    return value.replace(/\$\{([^}]+)\}/g, (_, varName: string) => {
      const envValue = process.env[varName];
      if (envValue === undefined) {
        throw new ConfigValidationError(
          `Environment variable '${varName}' referenced in config but not set`,
        );
      }
      return envValue;
    });
  }
}

// ============================================================================
// Legacy exports (backwards compatibility)
// ============================================================================

/**
 * Load configuration (legacy function, use Config.load() instead)
 */
export async function loadConfig(): Promise<Config> {
  return Config.load();
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Format Zod errors into a human-readable string
 */
export function formatZodErrors(error: z.ZodError): string {
  return error.issues
    .map((e) => {
      const path = e.path.join(".");
      return path ? `  - ${path}: ${e.message}` : `  - ${e.message}`;
    })
    .join("\n");
}

/**
 * Example config file content for `q config init`
 */
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

# Example: Portkey Gateway (dedicated provider type for AI gateway routing)
# Supports internal/self-hosted Portkey deployments
# [providers.portkey_internal]
# type = "portkey"
# base_url = "https://your-portkey-gateway.internal/v1"
# provider_slug = "@your-org/bedrock-provider"  # Maps to x-portkey-provider header
# api_key_env = "PORTKEY_API_KEY"               # Maps to x-portkey-api-key header (optional)
# provider_api_key_env = "PROVIDER_API_KEY"     # Maps to Authorization header (optional)
# headers = { "x-custom" = "\${CUSTOM_VALUE}" } # Additional headers (optional)

# Example: Portkey Cloud (public API)
# [providers.portkey]
# type = "portkey"
# base_url = "https://api.portkey.ai/v1"
# provider_slug = "openai"
# api_key_env = "PORTKEY_API_KEY"

# Example: Ollama (local models)
# [providers.ollama]
# type = "ollama"
# base_url = "http://localhost:11434"
`;

/**
 * Initialize a new config file at the XDG path
 */
export async function initConfig(): Promise<string> {
  const configPath = getXdgConfigPath();
  const configDir = getXdgConfigDir();

  // Create directory if it doesn't exist
  await mkdir(configDir, { recursive: true });

  // Check if config already exists
  const file = Bun.file(configPath);
  if (await file.exists()) {
    return `Config already exists at: ${configPath}`;
  }

  // Write example config
  await Bun.write(configPath, EXAMPLE_CONFIG);
  return `Created config file at: ${configPath}`;
}
