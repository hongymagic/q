# Feature: New AI Providers

## Overview

Add support for Google Gemini, Groq, Azure OpenAI, and AWS Bedrock providers.

## Providers to Add

| Provider     | SDK                        | Use Case                            |
| ------------ | -------------------------- | ----------------------------------- |
| Google Gemini | `@ai-sdk/google`          | Gemini 2.0, multimodal, fast        |
| Groq         | `@ai-sdk/groq`             | Ultra-fast inference (Llama, Mixtral) |
| Azure OpenAI | `@ai-sdk/azure`            | Enterprise Azure deployments        |
| AWS Bedrock  | `@ai-sdk/amazon-bedrock`   | AWS-native, Claude/Titan/Llama      |

## Implementation

### Dependencies to Add

```bash
bun add @ai-sdk/google @ai-sdk/groq @ai-sdk/azure @ai-sdk/amazon-bedrock
```

### Config Schema Updates

#### `src/config/index.ts`

```typescript
// Update ProviderType enum
export const ProviderType = z.enum([
  "openai",
  "anthropic",
  "openai_compatible",
  "ollama",
  "portkey",
  // New providers
  "google",
  "groq",
  "azure",
  "bedrock",
]);

// Add provider-specific fields to ProviderConfigSchema
export const ProviderConfigSchema = z.object({
  type: ProviderType,
  api_key_env: z.string().optional(),
  base_url: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  // Portkey fields (existing)
  provider_slug: z.string().optional(),
  provider_api_key_env: z.string().optional(),
  // Azure fields (new)
  resource_name: z.string().optional(),
  deployment_name: z.string().optional(),
  api_version: z.string().optional(),
  // Bedrock fields (new)
  region: z.string().optional(),
  access_key_env: z.string().optional(),
  secret_key_env: z.string().optional(),
});

// Update allowed interpolation vars
const ALLOWED_INTERPOLATION_VARS = new Set([
  // ... existing vars
  // Google
  "GOOGLE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  // Groq
  "GROQ_API_KEY",
  // Azure
  "AZURE_API_KEY",
  "AZURE_OPENAI_API_KEY",
  // AWS
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
  "AWS_SESSION_TOKEN",
]);
```

### New Provider Files

#### `src/providers/google.ts`

```typescript
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ProviderConfig } from "../config/index.ts";
import { MissingApiKeyError } from "../errors.ts";

export function createGoogleProvider(
  config: ProviderConfig,
  providerName: string
) {
  let apiKey: string | undefined;

  if (config.api_key_env) {
    apiKey = process.env[config.api_key_env];
    if (!apiKey) {
      throw new MissingApiKeyError(config.api_key_env, providerName);
    }
  }

  return createGoogleGenerativeAI({
    apiKey,
    baseURL: config.base_url,
    headers: config.headers,
  });
}
```

#### `src/providers/groq.ts`

```typescript
import { createGroq } from "@ai-sdk/groq";
import type { ProviderConfig } from "../config/index.ts";
import { MissingApiKeyError } from "../errors.ts";

export function createGroqProvider(
  config: ProviderConfig,
  providerName: string
) {
  let apiKey: string | undefined;

  if (config.api_key_env) {
    apiKey = process.env[config.api_key_env];
    if (!apiKey) {
      throw new MissingApiKeyError(config.api_key_env, providerName);
    }
  }

  return createGroq({
    apiKey,
    baseURL: config.base_url,
    headers: config.headers,
  });
}
```

#### `src/providers/azure.ts`

```typescript
import { createAzure } from "@ai-sdk/azure";
import type { ProviderConfig } from "../config/index.ts";
import { ConfigValidationError, MissingApiKeyError } from "../errors.ts";

export function createAzureProvider(
  config: ProviderConfig,
  providerName: string
) {
  let apiKey: string | undefined;

  if (config.api_key_env) {
    apiKey = process.env[config.api_key_env];
    if (!apiKey) {
      throw new MissingApiKeyError(config.api_key_env, providerName);
    }
  }

  if (!config.resource_name) {
    throw new ConfigValidationError(
      `Azure provider '${providerName}' requires 'resource_name'`
    );
  }

  return createAzure({
    apiKey,
    resourceName: config.resource_name,
    apiVersion: config.api_version,
    headers: config.headers,
  });
}
```

#### `src/providers/bedrock.ts`

```typescript
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import type { ProviderConfig } from "../config/index.ts";
import { MissingApiKeyError } from "../errors.ts";

export function createBedrockProvider(
  config: ProviderConfig,
  providerName: string
) {
  let accessKeyId: string | undefined;
  let secretAccessKey: string | undefined;

  if (config.access_key_env) {
    accessKeyId = process.env[config.access_key_env];
    if (!accessKeyId) {
      throw new MissingApiKeyError(config.access_key_env, providerName);
    }
  }

  if (config.secret_key_env) {
    secretAccessKey = process.env[config.secret_key_env];
    if (!secretAccessKey) {
      throw new MissingApiKeyError(config.secret_key_env, providerName);
    }
  }

  return createAmazonBedrock({
    region: config.region ?? process.env.AWS_REGION ?? "us-east-1",
    accessKeyId,
    secretAccessKey,
  });
}
```

### Update Provider Factory

#### `src/providers/index.ts`

```typescript
import { createGoogleProvider } from "./google.ts";
import { createGroqProvider } from "./groq.ts";
import { createAzureProvider } from "./azure.ts";
import { createBedrockProvider } from "./bedrock.ts";

function createModel(
  config: ProviderConfig,
  providerName: string,
  modelId: string,
  debug = false
): LanguageModel {
  switch (config.type) {
    // ... existing cases

    case "google": {
      const provider = createGoogleProvider(config, providerName);
      return provider(modelId);
    }
    case "groq": {
      const provider = createGroqProvider(config, providerName);
      return provider(modelId);
    }
    case "azure": {
      const provider = createAzureProvider(config, providerName);
      // Azure uses deployment name as model ID
      return provider(config.deployment_name ?? modelId);
    }
    case "bedrock": {
      const provider = createBedrockProvider(config, providerName);
      return provider(modelId);
    }
  }
}
```

### Example Configs

#### Update `config.example.toml`

```toml
# Google Gemini
# [providers.google]
# type = "google"
# api_key_env = "GOOGLE_API_KEY"
# # Models: gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash

# Groq (ultra-fast inference)
# [providers.groq]
# type = "groq"
# api_key_env = "GROQ_API_KEY"
# # Models: llama-3.3-70b-versatile, mixtral-8x7b-32768, gemma2-9b-it

# Azure OpenAI
# [providers.azure]
# type = "azure"
# resource_name = "my-azure-resource"
# deployment_name = "gpt-4o-deployment"
# api_key_env = "AZURE_OPENAI_API_KEY"
# api_version = "2024-02-15-preview"

# AWS Bedrock
# [providers.bedrock]
# type = "bedrock"
# region = "us-east-1"
# access_key_env = "AWS_ACCESS_KEY_ID"
# secret_key_env = "AWS_SECRET_ACCESS_KEY"
# # Models: anthropic.claude-3-5-sonnet-20241022-v2:0, amazon.titan-text-premier-v1:0
```

## Testing

#### `tests/providers.test.ts` (additions)

```typescript
describe("Google provider", () => {
  it("should create provider with API key");
  it("should throw on missing API key");
  it("should pass custom headers");
});

describe("Groq provider", () => {
  it("should create provider with API key");
  it("should throw on missing API key");
  it("should pass custom base URL");
});

describe("Azure provider", () => {
  it("should create provider with required fields");
  it("should throw on missing resource_name");
  it("should throw on missing API key");
  it("should use deployment_name for model");
});

describe("Bedrock provider", () => {
  it("should create provider with credentials");
  it("should use default region when not specified");
  it("should use AWS_REGION env var as fallback");
  it("should throw on missing access key");
  it("should throw on missing secret key");
});
```

#### `tests/schema.test.ts` (additions)

```typescript
describe("Provider config schema", () => {
  it("should accept google provider type");
  it("should accept groq provider type");
  it("should accept azure provider type");
  it("should accept bedrock provider type");
  it("should accept azure-specific fields");
  it("should accept bedrock-specific fields");
});
```

## Acceptance Criteria

- [ ] Google Gemini provider works with `gemini-2.0-flash`
- [ ] Groq provider works with `llama-3.3-70b-versatile`
- [ ] Azure OpenAI provider works with deployed models
- [ ] AWS Bedrock provider works with Claude/Titan models
- [ ] Config validation catches missing required fields
- [ ] New env vars added to interpolation allowlist
- [ ] Example config updated with all new providers
- [ ] Provider type enum updated
- [ ] Tests pass
- [ ] AGENTS.md updated with new provider types

## Effort Estimate

- Implementation: 3-4 hours
- Testing: 2 hours
- Documentation: 1 hour
