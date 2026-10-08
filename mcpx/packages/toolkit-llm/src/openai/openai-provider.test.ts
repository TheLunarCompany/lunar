import { describe, it, expect } from "@jest/globals";
import { z } from "zod/v4";
import {
  OpenAiLlmClient,
  OpenAiClientInterface,
  ResponsesParseParams,
} from "./openai-provider.js";
import { LlmEmptyResponseError } from "../errors.js";

const testSchema = z.object({ answer: z.string() });
type TestResponse = z.infer<typeof testSchema>;

class FakeOpenAiClient implements OpenAiClientInterface {
  calls: ResponsesParseParams[] = [];
  responseToReturn: { output_parsed: TestResponse | null } = {
    output_parsed: null,
  };

  responses = {
    parse: async <T>(params: ResponsesParseParams) => {
      this.calls.push(params);
      return this.responseToReturn as { output_parsed: T | null };
    },
  };
}

describe("OpenAiLlmClient", () => {
  it("should transform systemPrompt and messages into input array", async () => {
    const fake = new FakeOpenAiClient();
    fake.responseToReturn = { output_parsed: { answer: "42" } };
    const client = new OpenAiLlmClient("key", "gpt-4o", fake);

    await client.complete({
      systemPrompt: "You are helpful",
      messages: [{ role: "user", content: "What is 6*7?" }],
      responseSchema: testSchema,
    });

    expect(fake.calls).toHaveLength(1);
    const call = fake.calls[0]!;
    expect(call.model).toBe("gpt-4o");
    expect(call.input[0]).toEqual({
      role: "system",
      content: "You are helpful",
    });
    expect(call.input[1]).toEqual({ role: "user", content: "What is 6*7?" });
  });

  it("should return parsed response", async () => {
    const fake = new FakeOpenAiClient();
    fake.responseToReturn = { output_parsed: { answer: "42" } };
    const client = new OpenAiLlmClient("key", "gpt-4o", fake);

    const result = await client.complete({
      systemPrompt: "test",
      messages: [{ role: "user", content: "test" }],
      responseSchema: testSchema,
    });

    expect(result).toEqual({ answer: "42" });
  });

  it("should throw LlmEmptyResponseError when output_parsed is null", async () => {
    const fake = new FakeOpenAiClient();
    fake.responseToReturn = { output_parsed: null };
    const client = new OpenAiLlmClient("key", "gpt-4o", fake);

    await expect(
      client.complete({
        systemPrompt: "test",
        messages: [{ role: "user", content: "test" }],
        responseSchema: testSchema,
      }),
    ).rejects.toThrow(LlmEmptyResponseError);
  });
});
