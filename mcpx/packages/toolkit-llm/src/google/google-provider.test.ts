import { describe, it, expect } from "@jest/globals";
import { z } from "zod/v4";
import {
  GoogleLlmClient,
  GoogleGenAiClientInterface,
  GenerateContentParams,
} from "./google-provider.js";
import { LlmParseError } from "../errors.js";

const testSchema = z.object({ answer: z.string() });

class FakeGoogleClient implements GoogleGenAiClientInterface {
  calls: GenerateContentParams[] = [];
  responseToReturn: { text?: string } = { text: "{}" };

  models = {
    generateContent: async (params: GenerateContentParams) => {
      this.calls.push(params);
      return this.responseToReturn;
    },
  };
}

describe("GoogleLlmClient", () => {
  it("should pass systemPrompt to config.systemInstruction", async () => {
    const fake = new FakeGoogleClient();
    fake.responseToReturn = { text: JSON.stringify({ answer: "42" }) };
    const client = new GoogleLlmClient("key", "gemini-2.0-flash", fake);

    await client.complete({
      systemPrompt: "You are helpful",
      messages: [{ role: "user", content: "What is 6*7?" }],
      responseSchema: testSchema,
    });

    expect(fake.calls).toHaveLength(1);
    const call = fake.calls[0]!;
    expect(call.model).toBe("gemini-2.0-flash");
    expect(call.config.systemInstruction).toBe("You are helpful");
    expect(call.config.responseMimeType).toBe("application/json");
  });

  it("should join messages into contents", async () => {
    const fake = new FakeGoogleClient();
    fake.responseToReturn = { text: JSON.stringify({ answer: "42" }) };
    const client = new GoogleLlmClient("key", "gemini-2.0-flash", fake);

    await client.complete({
      systemPrompt: "test",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
        { role: "user", content: "What is 6*7?" },
      ],
      responseSchema: testSchema,
    });

    expect(fake.calls[0]!.contents[0]).toBe("Hello\nHi\nWhat is 6*7?");
  });

  it("should parse and return valid response", async () => {
    const fake = new FakeGoogleClient();
    fake.responseToReturn = { text: JSON.stringify({ answer: "42" }) };
    const client = new GoogleLlmClient("key", "gemini-2.0-flash", fake);

    const result = await client.complete({
      systemPrompt: "test",
      messages: [{ role: "user", content: "test" }],
      responseSchema: testSchema,
    });

    expect(result).toEqual({ answer: "42" });
  });

  it("should throw LlmParseError when response doesn't match schema", async () => {
    const fake = new FakeGoogleClient();
    fake.responseToReturn = { text: JSON.stringify({ wrong: "field" }) };
    const client = new GoogleLlmClient("key", "gemini-2.0-flash", fake);

    await expect(
      client.complete({
        systemPrompt: "test",
        messages: [{ role: "user", content: "test" }],
        responseSchema: testSchema,
      }),
    ).rejects.toThrow(LlmParseError);
  });

  it("should throw when response is invalid JSON object", async () => {
    const fake = new FakeGoogleClient();
    fake.responseToReturn = { text: "not json" };
    const client = new GoogleLlmClient("key", "gemini-2.0-flash", fake);

    await expect(
      client.complete({
        systemPrompt: "test",
        messages: [{ role: "user", content: "test" }],
        responseSchema: testSchema,
      }),
    ).rejects.toThrow();
  });
});
