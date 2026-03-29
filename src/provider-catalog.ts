type ProviderConfigLike = {
  type: string;
  model?: string;
  api_key_env?: string;
  base_url?: string;
  headers?: Record<string, string>;
  provider_slug?: string;
  provider_api_key_env?: string;
  resource_name?: string;
  api_version?: string;
  region?: string;
  access_key_env?: string;
  secret_key_env?: string;
};

type Environment = NodeJS.ProcessEnv;

export const GOOGLE_API_KEY_ENV_VARS = [
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
] as const;

const DEFAULT_MODEL_BY_PROVIDER_TYPE = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o-mini",
  google: "gemini-2.5-flash",
  groq: "openai/gpt-oss-20b",
  ollama: "gemma3",
  bedrock: "us.anthropic.claude-sonnet-4-20250514-v1:0",
} as const;

const ENV_PROVIDER_INFERENCE_ORDER = [
  "google",
  "groq",
  "anthropic",
  "openai",
  "bedrock",
  "azure",
] as const;

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function hasAnyEnv(envVars: readonly string[], env: Environment): boolean {
  return envVars.some((envVar) => Boolean(env[envVar]));
}

function hasAllEnv(envVars: readonly string[], env: Environment): boolean {
  return envVars.every((envVar) => Boolean(env[envVar]));
}

function formatStatus(present: boolean): string {
  return present ? "set" : "missing";
}

function describeAnyOf(
  label: string,
  envVars: readonly string[],
  env: Environment,
): { line: string; issue?: string } {
  const present = hasAnyEnv(envVars, env);
  const display = envVars.join(" or ");
  return {
    line: `${label}: ${display} (${formatStatus(present)})`,
    issue: present ? undefined : `${display} is not set`,
  };
}

function describeAllOf(
  label: string,
  envVars: readonly string[],
  env: Environment,
): { line: string; issue?: string } {
  const present = hasAllEnv(envVars, env);
  const display = envVars.join(" + ");
  return {
    line: `${label}: ${display} (${formatStatus(present)})`,
    issue: present ? undefined : `${display} is not set`,
  };
}

export function getGoogleApiKeyEnvVars(configuredEnvVar?: string): string[] {
  if (!configuredEnvVar) {
    return [...GOOGLE_API_KEY_ENV_VARS];
  }

  if (GOOGLE_API_KEY_ENV_VARS.some((envVar) => envVar === configuredEnvVar)) {
    return dedupe([configuredEnvVar, ...GOOGLE_API_KEY_ENV_VARS]);
  }

  return [configuredEnvVar];
}

export function getBuiltInProviderConfigs(
  env: Environment = process.env,
): Record<string, ProviderConfigLike> {
  return {
    anthropic: {
      type: "anthropic",
      api_key_env: "ANTHROPIC_API_KEY",
    },
    openai: {
      type: "openai",
      api_key_env: "OPENAI_API_KEY",
    },
    google: {
      type: "google",
      api_key_env: GOOGLE_API_KEY_ENV_VARS[0],
    },
    groq: {
      type: "groq",
      api_key_env: "GROQ_API_KEY",
    },
    ollama: {
      type: "ollama",
    },
    azure: {
      type: "azure",
      api_key_env: "AZURE_API_KEY",
      ...(env.AZURE_RESOURCE_NAME
        ? { resource_name: env.AZURE_RESOURCE_NAME }
        : {}),
    },
    bedrock: {
      type: "bedrock",
      ...(env.AWS_REGION ? { region: env.AWS_REGION } : {}),
    },
  };
}

export function getDefaultModelForProviderType(
  providerType: string,
): string | undefined {
  return DEFAULT_MODEL_BY_PROVIDER_TYPE[
    providerType as keyof typeof DEFAULT_MODEL_BY_PROVIDER_TYPE
  ];
}

export function getDefaultModelForProvider(
  providerConfig: ProviderConfigLike | undefined,
): string | undefined {
  if (!providerConfig) {
    return undefined;
  }

  return (
    providerConfig.model ?? getDefaultModelForProviderType(providerConfig.type)
  );
}

export function inferProviderFromEnvironment(
  env: Environment = process.env,
): string | undefined {
  for (const providerName of ENV_PROVIDER_INFERENCE_ORDER) {
    switch (providerName) {
      case "google":
        if (hasAnyEnv(GOOGLE_API_KEY_ENV_VARS, env)) {
          return providerName;
        }
        break;
      case "groq":
        if (env.GROQ_API_KEY) {
          return providerName;
        }
        break;
      case "anthropic":
        if (env.ANTHROPIC_API_KEY) {
          return providerName;
        }
        break;
      case "openai":
        if (env.OPENAI_API_KEY) {
          return providerName;
        }
        break;
      case "bedrock":
        if (
          (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) ||
          env.AWS_PROFILE
        ) {
          return providerName;
        }
        break;
      case "azure":
        if (env.AZURE_API_KEY && env.AZURE_RESOURCE_NAME) {
          return providerName;
        }
        break;
    }
  }

  return undefined;
}

export async function detectLocalProvider(): Promise<"ollama" | undefined> {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(200),
    });

    if (response.ok) {
      return "ollama";
    }
  } catch {
    // Ignore connectivity failures; local detection is opportunistic only.
  }

  return undefined;
}

export function getProviderStatusSummary(
  providerConfig: ProviderConfigLike,
  env: Environment = process.env,
): { lines: string[]; issues: string[] } {
  switch (providerConfig.type) {
    case "ollama":
      return {
        lines: ["Auth: none required"],
        issues: [],
      };

    case "google": {
      const apiKey = describeAnyOf(
        "Key",
        getGoogleApiKeyEnvVars(providerConfig.api_key_env),
        env,
      );
      return {
        lines: [apiKey.line],
        issues: apiKey.issue ? [apiKey.issue] : [],
      };
    }

    case "azure": {
      const lines: string[] = [];
      const issues: string[] = [];
      const apiKey = describeAnyOf(
        "Key",
        [providerConfig.api_key_env ?? "AZURE_API_KEY"],
        env,
      );
      lines.push(apiKey.line);
      if (apiKey.issue) {
        issues.push(apiKey.issue);
      }

      if (providerConfig.base_url) {
        lines.push("Endpoint: base_url configured");
      } else if (providerConfig.resource_name) {
        lines.push(`Endpoint: resource ${providerConfig.resource_name}`);
      } else {
        lines.push("Endpoint: set AZURE_RESOURCE_NAME or base_url");
        issues.push("AZURE_RESOURCE_NAME or base_url is required");
      }

      return { lines, issues };
    }

    case "bedrock": {
      if (providerConfig.access_key_env || providerConfig.secret_key_env) {
        const credentials = describeAllOf(
          "AWS credentials",
          [
            providerConfig.access_key_env ?? "AWS_ACCESS_KEY_ID",
            providerConfig.secret_key_env ?? "AWS_SECRET_ACCESS_KEY",
          ],
          env,
        );
        return {
          lines: [credentials.line],
          issues: credentials.issue ? [credentials.issue] : [],
        };
      }

      return {
        lines: ["Auth: AWS SDK default credential chain"],
        issues: [],
      };
    }

    case "openai_compatible": {
      const lines: string[] = [];
      const issues: string[] = [];

      if (providerConfig.api_key_env) {
        const apiKey = describeAnyOf("Key", [providerConfig.api_key_env], env);
        lines.push(apiKey.line);
        if (apiKey.issue) {
          issues.push(apiKey.issue);
        }
      } else {
        lines.push("Key: (none required)");
      }

      if (providerConfig.base_url) {
        lines.push("Endpoint: base_url configured");
      } else {
        lines.push("Endpoint: missing base_url");
        issues.push("base_url is required");
      }

      return { lines, issues };
    }

    case "portkey": {
      const lines: string[] = [];
      const issues: string[] = [];

      if (providerConfig.api_key_env) {
        const apiKey = describeAnyOf(
          "Gateway key",
          [providerConfig.api_key_env],
          env,
        );
        lines.push(apiKey.line);
        if (apiKey.issue) {
          issues.push(apiKey.issue);
        }
      } else {
        lines.push("Gateway key: (optional)");
      }

      if (providerConfig.provider_api_key_env) {
        const providerKey = describeAnyOf(
          "Upstream key",
          [providerConfig.provider_api_key_env],
          env,
        );
        lines.push(providerKey.line);
        if (providerKey.issue) {
          issues.push(providerKey.issue);
        }
      } else {
        lines.push("Upstream key: (optional)");
      }

      if (!providerConfig.base_url) {
        issues.push("base_url is required");
        lines.push("Endpoint: missing base_url");
      } else {
        lines.push("Endpoint: base_url configured");
      }

      if (!providerConfig.provider_slug) {
        issues.push("provider_slug is required");
        lines.push("Provider slug: missing");
      } else {
        lines.push(`Provider slug: ${providerConfig.provider_slug}`);
      }

      return { lines, issues };
    }

    default: {
      if (!providerConfig.api_key_env) {
        return {
          lines: ["Key: (none required)"],
          issues: [],
        };
      }

      const apiKey = describeAnyOf("Key", [providerConfig.api_key_env], env);
      return {
        lines: [apiKey.line],
        issues: apiKey.issue ? [apiKey.issue] : [],
      };
    }
  }
}
