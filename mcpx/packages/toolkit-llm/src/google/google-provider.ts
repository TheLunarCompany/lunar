import { GoogleGenAI } from "@google/genai";
import { z } from "zod/v4";
import { LlmClient, LlmCompletionParams, LlmMessage } from "../types.js";
import { LlmApiError, LlmParseError } from "../errors.js";

/**
 * Types for Google GenAI SDK usage.
 * Extracted to allow dependency injection for testing.
 */
export interface GenerateContentParams {
  model: string;
  contents: string[];
  config: {
    systemInstruction: string;
    responseMimeType: string;
    responseJsonSchema: unknown;
  };
}

export interface GenerateContentResponse {
  text?: string;
  usageMetadata?: { totalTokenCount?: number };
}

export interface GoogleGenAiClientInterface {
  models: {
    generateContent(
      params: GenerateContentParams,
    ): Promise<GenerateContentResponse>;
  };
}

/**
 * Google GenAI LLM client with structured output support.
 * Uses Google's generateContent() with JSON schema for structured responses.
 */
export class GoogleLlmClient implements LlmClient {
  private client: GoogleGenAiClientInterface;
  private model: string;

  constructor(
    apiKey: string,
    model: string,
    genAiClient?: GoogleGenAiClientInterface,
  ) {
    this.client = genAiClient ?? new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async complete<T>(params: LlmCompletionParams<T>): Promise<T> {
    const { systemPrompt, messages, responseSchema } = params;
    const response = await this.callApi(systemPrompt, messages, responseSchema);

    const parsed = responseSchema.safeParse(JSON.parse(response.text || "{}"));
    if (!parsed.success) {
      throw new LlmParseError(
        "Failed to parse Google GenAI response",
        parsed.error,
      );
    }

    return parsed.data;
  }

  private async callApi<T>(
    systemPrompt: string,
    messages: LlmMessage[],
    responseSchema: z.ZodSchema<T>,
  ): Promise<GenerateContentResponse> {
    const userContent = messages.map((m) => m.content).join("\n");

    try {
      return await this.client.models.generateContent({
        model: this.model,
        contents: [userContent],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(responseSchema),
        },
      });
    } catch (e) {
      throw new LlmApiError("GoogleGenAI", e);
    }
  }
}
