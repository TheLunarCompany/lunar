import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod/v4";
import { LlmApiError, LlmEmptyResponseError } from "../errors.js";
import { LlmClient, LlmCompletionParams, LlmMessage } from "../types.js";

/**
 * Types for OpenAI SDK usage.
 * Extracted to allow dependency injection for testing.
 */
export interface ResponsesParseParams {
  model: string;
  input: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  text: { format: ReturnType<typeof zodTextFormat> };
}

export interface ResponseUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface ResponsesParsedResponse<T> {
  usage?: ResponseUsage;
  output_parsed: T | null;
}

export interface OpenAiClientInterface {
  responses: {
    parse<T>(params: ResponsesParseParams): Promise<ResponsesParsedResponse<T>>;
  };
}

/**
 * OpenAI LLM client with structured output support.
 * Uses OpenAI's responses.parse() for Zod-validated JSON responses.
 */
export class OpenAiLlmClient implements LlmClient {
  private client: OpenAiClientInterface;
  private model: string;

  constructor(
    apiKey: string,
    model: string,
    openAiClient?: OpenAiClientInterface,
  ) {
    this.client = openAiClient ?? new OpenAI({ apiKey });
    this.model = model;
  }

  async complete<T>(params: LlmCompletionParams<T>): Promise<T> {
    const { systemPrompt, messages, responseSchema } = params;
    const response = await this.callApi(systemPrompt, messages, responseSchema);

    if (!response.output_parsed) {
      throw new LlmEmptyResponseError("OpenAI");
    }

    return response.output_parsed;
  }

  private async callApi<T>(
    systemPrompt: string,
    messages: LlmMessage[],
    responseSchema: z.ZodSchema<T>,
  ): Promise<ResponsesParsedResponse<T>> {
    const input: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    try {
      return await this.client.responses.parse({
        model: this.model,
        input,
        text: { format: zodTextFormat(responseSchema, "response") },
      });
    } catch (e) {
      throw new LlmApiError("OpenAI", e);
    }
  }
}
