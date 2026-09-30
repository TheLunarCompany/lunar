import { afterEach, describe, expect, it } from "@jest/globals";
import { noOpLogger } from "@mcpx/toolkit-core/logging";
import {
  ErrorCode,
  McpError,
  Prompt,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { resetEnv } from "../env.js";
import {
  CapabilitySource,
  fetchPromptCapabilities,
  fetchPromptMessages,
  fetchServerCapabilities,
  fetchToolCapabilities,
} from "./fetch-capabilities.js";

const originalEnv = { ...process.env };
// resetEnv() re-parses the full schema, so the required keys must be present.
const baseEnv = { ...process.env, VERSION: "1.0.0", INSTANCE_ID: "0" };

function setPromptCapability(enabled: boolean): void {
  process.env = { ...baseEnv };
  if (enabled) {
    process.env["ENABLE_PROMPT_CAPABILITY"] = "true";
  }
  resetEnv();
}

// CapabilitySource is exactly the methods the fetchers call, so the fake is
// fully typed against it — overrides are checked against the real listTools /
// listPrompts / getPrompt return shapes, no `unknown` and no cast.
function fakeClient(overrides: Partial<CapabilitySource>): CapabilitySource {
  return {
    listTools:
      overrides.listTools ?? (async () => ({ tools: [], toolParentNames: {} })),
    listPrompts: overrides.listPrompts ?? (async () => ({ prompts: [] })),
    getPrompt: overrides.getPrompt ?? (async () => ({ messages: [] })),
  };
}

function makeTool(name: string): Tool {
  return { name, inputSchema: { type: "object", properties: {} } };
}

function makePrompt(name: string): Prompt {
  return { name, description: `does ${name}` };
}

const methodNotFound = new McpError(ErrorCode.MethodNotFound, "not found");
const boom = new Error("transport blew up");

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("fetchToolCapabilities", () => {
  it("tags tools and carries tool parent names", async () => {
    setPromptCapability(false);
    const client = fakeClient({
      listTools: async () => ({
        tools: [{ name: "alpha", inputSchema: { type: "object" } }],
        toolParentNames: { "alpha.child": "alpha" },
      }),
    });

    const result = await fetchToolCapabilities(client);

    expect(result.tools).toEqual([
      {
        definition: { name: "alpha", inputSchema: { type: "object" } },
        origin: "upstream",
      },
    ]);
    expect(result.toolParentNames).toEqual({ "alpha.child": "alpha" });
  });

  it("treats MethodNotFound as no tools when prompts are enabled (prompt-only upstream connects)", async () => {
    setPromptCapability(true);
    const client = fakeClient({
      listTools: async () => Promise.reject(methodNotFound),
    });

    const result = await fetchToolCapabilities(client);

    expect(result.tools).toEqual([]);
  });

  it("rethrows MethodNotFound when prompts are disabled", async () => {
    setPromptCapability(false);
    const client = fakeClient({
      listTools: async () => Promise.reject(methodNotFound),
    });

    await expect(fetchToolCapabilities(client)).rejects.toBe(methodNotFound);
  });

  it("rethrows non-MethodNotFound errors even when prompts are enabled", async () => {
    setPromptCapability(true);
    const client = fakeClient({
      listTools: async () => Promise.reject(boom),
    });

    await expect(fetchToolCapabilities(client)).rejects.toBe(boom);
  });
});

describe("fetchPromptCapabilities", () => {
  it("returns no prompt entry and does not query when prompts are disabled", async () => {
    setPromptCapability(false);
    let called = false;
    const client = fakeClient({
      listPrompts: async () => {
        called = true;
        return { prompts: [] };
      },
    });

    const result = await fetchPromptCapabilities(client);

    expect(result).toEqual({});
    expect(called).toBe(false);
  });

  it("tags prompts when the upstream advertises them", async () => {
    setPromptCapability(true);
    const client = fakeClient({
      listPrompts: async () => ({ prompts: [{ name: "greet" }] }),
    });

    const result = await fetchPromptCapabilities(client);

    expect(result.prompts).toEqual([
      { definition: { name: "greet" }, origin: "upstream" },
    ]);
  });

  it("returns undefined prompts for an empty list (clears any stale entry on merge)", async () => {
    setPromptCapability(true);
    const client = fakeClient({
      listPrompts: async () => ({ prompts: [] }),
    });

    const result = await fetchPromptCapabilities(client);

    expect(result).toEqual({ prompts: undefined });
  });

  it("treats MethodNotFound as undefined prompts (clears stale prompts when a server stops advertising)", async () => {
    setPromptCapability(true);
    const client = fakeClient({
      listPrompts: async () => Promise.reject(methodNotFound),
    });

    const result = await fetchPromptCapabilities(client);

    expect(result).toEqual({ prompts: undefined });
  });

  it("treats a StreamableHTTP-serialised MethodNotFound as undefined prompts", async () => {
    setPromptCapability(true);
    const serialised = new Error(`{"code":${ErrorCode.MethodNotFound}}`);
    const client = fakeClient({
      listPrompts: async () => Promise.reject(serialised),
    });

    const result = await fetchPromptCapabilities(client);

    expect(result).toEqual({ prompts: undefined });
  });

  it("rethrows non-MethodNotFound errors", async () => {
    setPromptCapability(true);
    const client = fakeClient({
      listPrompts: async () => Promise.reject(boom),
    });

    await expect(fetchPromptCapabilities(client)).rejects.toBe(boom);
  });
});

// A server advertising only one of tools/prompts must still connect.
describe("fetchServerCapabilities (one capability, not the other is OK)", () => {
  it("combines tools and prompts when the upstream has both", async () => {
    setPromptCapability(true);
    const client = fakeClient({
      listTools: async () => ({
        tools: [makeTool("alpha")],
        toolParentNames: {},
      }),
      listPrompts: async () => ({ prompts: [{ name: "greet" }] }),
    });

    const result = await fetchServerCapabilities(client, noOpLogger);

    expect(result.tools).toEqual([
      { definition: makeTool("alpha"), origin: "upstream" },
    ]);
    expect(result.prompts).toEqual([
      { definition: { name: "greet" }, origin: "upstream" },
    ]);
  });

  it("connects a tool-only upstream (no prompts -> prompts undefined)", async () => {
    setPromptCapability(true);
    const client = fakeClient({
      listTools: async () => ({
        tools: [makeTool("alpha")],
        toolParentNames: {},
      }),
      listPrompts: async () => Promise.reject(methodNotFound),
    });

    const result = await fetchServerCapabilities(client, noOpLogger);

    expect(result.tools).toEqual([
      { definition: makeTool("alpha"), origin: "upstream" },
    ]);
    expect(result.prompts).toBeUndefined();
  });

  it("connects a prompt-only upstream (no tools -> tools [])", async () => {
    setPromptCapability(true);
    const client = fakeClient({
      listTools: async () => Promise.reject(methodNotFound),
      listPrompts: async () => ({ prompts: [{ name: "greet" }] }),
    });

    const result = await fetchServerCapabilities(client, noOpLogger);

    expect(result.tools).toEqual([]);
    expect(result.prompts).toEqual([
      { definition: { name: "greet" }, origin: "upstream" },
    ]);
  });

  it("drops a prompts failure when tools loaded (connects with tools only)", async () => {
    setPromptCapability(true);
    const client = fakeClient({
      listTools: async () => ({
        tools: [makeTool("alpha")],
        toolParentNames: {},
      }),
      listPrompts: async () => Promise.reject(boom),
    });

    const result = await fetchServerCapabilities(client, noOpLogger);

    expect(result.tools).toEqual([
      { definition: makeTool("alpha"), origin: "upstream" },
    ]);
    expect(result).not.toHaveProperty("prompts");
  });

  it("surfaces a prompts failure when tools came back empty (no usable capability)", async () => {
    setPromptCapability(true);
    const client = fakeClient({
      // tools/list MethodNotFound -> tools [], so prompts is the only chance at
      // a usable capability; a real prompts failure must not connect empty.
      listTools: async () => Promise.reject(methodNotFound),
      listPrompts: async () => Promise.reject(boom),
    });

    await expect(fetchServerCapabilities(client, noOpLogger)).rejects.toBe(
      boom,
    );
  });

  it("fails the connection when tools/list errors (tools are required)", async () => {
    setPromptCapability(true);
    const client = fakeClient({
      listTools: async () => Promise.reject(boom),
      listPrompts: async () => ({ prompts: [{ name: "greet" }] }),
    });

    await expect(fetchServerCapabilities(client, noOpLogger)).rejects.toBe(
      boom,
    );
  });

  it("does not connect a prompt-only upstream when the flag is off", async () => {
    setPromptCapability(false);
    const client = fakeClient({
      listTools: async () => Promise.reject(methodNotFound),
      listPrompts: async () => ({ prompts: [{ name: "greet" }] }),
    });

    await expect(fetchServerCapabilities(client, noOpLogger)).rejects.toBe(
      methodNotFound,
    );
  });
});

describe("fetchPromptMessages", () => {
  const message = (text: string) => ({
    role: "user" as const,
    content: { type: "text" as const, text },
  });

  it("caches messages per prompt name, keyed by name", async () => {
    const client = fakeClient({
      getPrompt: async ({ name }) => ({ messages: [message(`hi ${name}`)] }),
    });

    const result = await fetchPromptMessages(
      client,
      [makePrompt("summarize"), makePrompt("draft")],
      noOpLogger,
    );

    expect(result).toEqual({
      summarize: [message("hi summarize")],
      draft: [message("hi draft")],
    });
  });

  it("fetches each prompt with empty arguments", async () => {
    const calls: unknown[] = [];
    const client = fakeClient({
      getPrompt: async (params) => {
        calls.push(params);
        return { messages: [] };
      },
    });

    await fetchPromptMessages(client, [makePrompt("summarize")], noOpLogger);

    expect(calls).toEqual([{ name: "summarize", arguments: {} }]);
  });

  it("skips prompts whose getPrompt fails (e.g. requires arguments)", async () => {
    const client = fakeClient({
      getPrompt: async ({ name }) => {
        if (name === "needs-args")
          throw new McpError(ErrorCode.InvalidParams, "missing arg");
        return { messages: [message("ok")] };
      },
    });

    const result = await fetchPromptMessages(
      client,
      [makePrompt("needs-args"), makePrompt("simple")],
      noOpLogger,
    );

    expect(result).toEqual({ simple: [message("ok")] });
    expect(result["needs-args"]).toBeUndefined();
  });

  it("returns an empty record when every prompt fails", async () => {
    const client = fakeClient({
      getPrompt: async () => Promise.reject(boom),
    });

    const result = await fetchPromptMessages(
      client,
      [makePrompt("a"), makePrompt("b")],
      noOpLogger,
    );

    expect(result).toEqual({});
  });

  it("returns an empty record for no prompts", async () => {
    const result = await fetchPromptMessages(fakeClient({}), [], noOpLogger);
    expect(result).toEqual({});
  });
});
