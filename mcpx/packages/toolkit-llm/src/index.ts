export * from "./types.js";
export * from "./errors.js";
export { OpenAiLlmClient } from "./openai/index.js";
export { GoogleLlmClient } from "./google/index.js";

import { withTimeout } from "@mcpx/toolkit-core/time";
import { LlmConfig, LlmClient, LlmCompletionParams } from "./types.js";
import { OpenAiLlmClient } from "./openai/index.js";
import { GoogleLlmClient } from "./google/index.js";

/**
 * Factory function to create an LLM client based on provider configuration.
 * When timeoutMs is provided, the client's complete() call is wrapped with a timeout.
 */
export function createLlmClient(config: LlmConfig): LlmClient {
  const client = createProviderClient(config);
  if (config.timeoutMs) {
    return withTimeoutLlmClient(client, config.timeoutMs);
  }
  return client;
}

function createProviderClient(config: LlmConfig): LlmClient {
  switch (config.provider) {
    case "openai":
      return new OpenAiLlmClient(config.apiKey, config.model);
    case "google-gen-ai":
      return new GoogleLlmClient(config.apiKey, config.model);
  }
}

function withTimeoutLlmClient(client: LlmClient, timeoutMs: number): LlmClient {
  return {
    complete: <T>(params: LlmCompletionParams<T>): Promise<T> =>
      withTimeout(client.complete(params), timeoutMs, "LLM completion"),
  };
}
