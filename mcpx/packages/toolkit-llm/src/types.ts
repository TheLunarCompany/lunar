import { z } from "zod/v4";

export type LlmProviderType = "openai" | "google-gen-ai";

export interface LlmConfig {
  provider: LlmProviderType;
  model: string;
  apiKey: string;
  timeoutMs?: number;
}

/**
 * Chat message format used by LLM APIs.
 * User and assistant messages only - system prompt is passed separately.
 */
export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmCompletionParams<T> {
  systemPrompt: string;
  messages: LlmMessage[];
  responseSchema: z.ZodSchema<T>;
}

/**
 * Abstract interface for LLM clients with structured output.
 * Implementations handle provider-specific API differences while
 * presenting a unified interface for structured responses.
 */
export interface LlmClient {
  /**
   * Send messages to the LLM and get a structured response.
   * @param params - Completion parameters including system prompt, messages, and schema
   * @returns Parsed and validated response matching the schema
   * @throws Error if the LLM call fails or response doesn't match schema
   */
  complete<T>(params: LlmCompletionParams<T>): Promise<T>;
}
