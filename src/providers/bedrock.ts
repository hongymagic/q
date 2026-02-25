import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import type { ProviderConfig } from "../config/index.ts";
import { resolveApiKey } from "./index.ts";

export function createBedrockProvider(
  config: ProviderConfig,
  providerName: string,
) {
  // Support custom env var names for credentials
  // If not specified, SDK automatically uses AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY
  const accessKeyId = resolveApiKey(config.access_key_env, providerName);
  const secretAccessKey = resolveApiKey(config.secret_key_env, providerName);

  return createAmazonBedrock({
    region: config.region,
    ...(accessKeyId && { accessKeyId }),
    ...(secretAccessKey && { secretAccessKey }),
  });
}
