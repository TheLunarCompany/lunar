import { noOpLogger } from "@mcpx/toolkit-core/logging";
import {
  GetPromptResult,
  Prompt,
  Resource,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { CapabilityRegistry, tagTools } from "./capability-registry.js";
import {
  ActivePrompt,
  ActiveResource,
  ActiveTool,
  ConsumerContext,
} from "./capability-resolver.js";
import {
  HiddenInternalCapabilityError,
  InternalCapabilitiesService,
  InternalCapabilityProvider,
  InternalPromptHandler,
  InternalResourceHandler,
  InternalToolHandler,
  UnknownInternalCapabilityError,
  wireInternalCapabilityProvider,
} from "./internal-capabilities-service.js";

function makeTool(name: string): Tool {
  return { name, inputSchema: { type: "object" as const, properties: {} } };
}

function makeHandler(
  name: string,
  overrides: Partial<InternalToolHandler> = {},
): InternalToolHandler {
  return {
    kind: "tools",
    name,
    isVisible: () => true,
    handle: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
    ...overrides,
  };
}

function activeTool(serverName: string, capabilityName: string): ActiveTool {
  return {
    serverName,
    capabilityName,
    definition: makeTool(capabilityName),
    origin: "internal",
  };
}

// capabilityName is the real uri; definition.uri is the advertised (injected) one.
function activeResource(
  serverName: string,
  capabilityName: string,
  advertisedUri: string,
): ActiveResource {
  const definition: Resource = { uri: advertisedUri, name: capabilityName };
  return { serverName, capabilityName, definition, origin: "internal" };
}

function resourceHandler(
  serverName: string,
  read: (uri: string) => { mimeType: string; text: string } | undefined,
  overrides: Partial<InternalResourceHandler> = {},
): InternalResourceHandler {
  return {
    kind: "resources",
    serverName,
    isVisible: () => true,
    read,
    ...overrides,
  };
}

function activePrompt(
  serverName: string,
  capabilityName: string,
): ActivePrompt {
  const definition: Prompt = { name: capabilityName };
  return { serverName, capabilityName, definition, origin: "internal" };
}

function promptHandler(
  serverName: string,
  getPrompt: (name: string) => GetPromptResult | undefined,
  overrides: Partial<InternalPromptHandler> = {},
): InternalPromptHandler {
  return {
    kind: "prompts",
    serverName,
    isVisible: () => true,
    getPrompt,
    ...overrides,
  };
}

describe("wireInternalCapabilityProvider", () => {
  it("registers handlers and eager registrations atomically", () => {
    const registry = new CapabilityRegistry(noOpLogger);
    const internalCapabilities = new InternalCapabilitiesService(noOpLogger);
    const provider: InternalCapabilityProvider = {
      getInternalCapabilityRegistrations: () => ({
        handlers: [makeHandler("get_x")],
        eagerRegistrations: [
          {
            serverName: "mcpx",
            capabilities: { tools: tagTools([makeTool("get_x")], "internal") },
          },
        ],
      }),
    };

    wireInternalCapabilityProvider(provider, internalCapabilities, registry);

    expect(internalCapabilities.hasHandler("tools", "get_x")).toBe(true);
    expect(registry.servers.get("mcpx")?.tools).toHaveLength(1);
  });

  it("throws when an eager definition has no matching handler", () => {
    const registry = new CapabilityRegistry(noOpLogger);
    const internalCapabilities = new InternalCapabilitiesService(noOpLogger);
    const provider: InternalCapabilityProvider = {
      getInternalCapabilityRegistrations: () => ({
        handlers: [], // handler missing on purpose
        eagerRegistrations: [
          {
            serverName: "mcpx",
            capabilities: { tools: tagTools([makeTool("orphan")], "internal") },
          },
        ],
      }),
    };

    expect(() =>
      wireInternalCapabilityProvider(provider, internalCapabilities, registry),
    ).toThrow(/no handler/);
    // Registry must not be touched when validation fails.
    expect(registry.servers.size).toBe(0);
  });

  it("allows upstream-kind entries in eager registrations without handlers", () => {
    const registry = new CapabilityRegistry(noOpLogger);
    const internalCapabilities = new InternalCapabilitiesService(noOpLogger);
    const provider: InternalCapabilityProvider = {
      getInternalCapabilityRegistrations: () => ({
        handlers: [],
        eagerRegistrations: [
          {
            serverName: "slack",
            capabilities: { tools: tagTools([makeTool("post")], "upstream") },
          },
        ],
      }),
    };

    expect(() =>
      wireInternalCapabilityProvider(provider, internalCapabilities, registry),
    ).not.toThrow();
    expect(registry.servers.get("slack")?.tools?.[0]?.origin).toBe("upstream");
  });
});

describe("InternalCapabilitiesService.register", () => {
  it("rejects a second handler with the same name", () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    service.register(makeHandler("dup"));
    expect(() => service.register(makeHandler("dup"))).toThrow(
      /already registered/,
    );
  });

  it("hasHandler is gated on kind", () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    service.register(makeHandler("get_x"));
    expect(service.hasHandler("tools", "get_x")).toBe(true);
    expect(service.hasHandler("tools", "missing")).toBe(false);
  });
});

describe("InternalCapabilitiesService.visibleToolForListing", () => {
  it("returns the (optionally enriched) definition when visible", () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    service.register(
      makeHandler("get_x", {
        enrich: (def) => ({ ...def, description: "enriched" }),
      }),
    );

    const result = service.visibleToolForListing(
      activeTool("mcpx", "get_x"),
      {} as ConsumerContext,
    );

    expect(result?.description).toBe("enriched");
  });

  it("returns undefined when the handler hides the tool", () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    service.register(makeHandler("get_x", { isVisible: () => false }));

    expect(
      service.visibleToolForListing(
        activeTool("mcpx", "get_x"),
        {} as ConsumerContext,
      ),
    ).toBeUndefined();
  });

  it("returns undefined when the handler is missing (drift)", () => {
    const service = new InternalCapabilitiesService(noOpLogger);

    const result = service.visibleToolForListing(
      activeTool("github", "request_authentication_link"),
      {} as ConsumerContext,
    );

    expect(result).toBeUndefined();
  });
});

describe("InternalCapabilitiesService.dispatchTool", () => {
  it("invokes the matching handler", async () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    let receivedServer = "";
    service.register(
      makeHandler("get_x", {
        handle: async ({ serverName }) => {
          receivedServer = serverName;
          return { content: [{ type: "text" as const, text: "done" }] };
        },
      }),
    );

    const result = await service.dispatchTool(
      activeTool("mcpx", "get_x"),
      { a: 1 },
      {} as ConsumerContext,
    );

    expect(receivedServer).toBe("mcpx");
    expect(result).toEqual({ content: [{ type: "text", text: "done" }] });
  });

  it("throws UnknownInternalCapabilityError when no handler is registered", async () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    await expect(
      service.dispatchTool(
        activeTool("mcpx", "missing"),
        {},
        {} as ConsumerContext,
      ),
    ).rejects.toBeInstanceOf(UnknownInternalCapabilityError);
  });

  it("throws HiddenInternalCapabilityError when the handler hides the tool", async () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    service.register(makeHandler("get_x", { isVisible: () => false }));
    await expect(
      service.dispatchTool(
        activeTool("mcpx", "get_x"),
        {},
        {} as ConsumerContext,
      ),
    ).rejects.toBeInstanceOf(HiddenInternalCapabilityError);
  });
});

describe("InternalCapabilitiesService.dispatchResource", () => {
  const REAL_URI = "skill://abc/SKILL.md";
  const ADVERTISED_URI = "skill://mcpx-skills/abc/SKILL.md";

  it("reads by the real uri and echoes the advertised uri in the envelope", () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    let readArg = "";
    service.register(
      resourceHandler("mcpx-skills", (uri) => {
        readArg = uri;
        return { mimeType: "text/markdown", text: "# body" };
      }),
    );

    const result = service.dispatchResource(
      activeResource("mcpx-skills", REAL_URI, ADVERTISED_URI),
      {},
    );

    expect(readArg).toBe(REAL_URI);
    expect(result).toEqual({
      contents: [
        { uri: ADVERTISED_URI, mimeType: "text/markdown", text: "# body" },
      ],
    });
  });

  it("returns undefined when the repository has no content for the uri", () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    service.register(resourceHandler("mcpx-skills", () => undefined));

    expect(
      service.dispatchResource(
        activeResource("mcpx-skills", REAL_URI, ADVERTISED_URI),
        {},
      ),
    ).toBeUndefined();
  });

  it("returns undefined when the handler hides the resource", () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    service.register(
      resourceHandler(
        "mcpx-skills",
        () => ({ mimeType: "text/markdown", text: "# body" }),
        { isVisible: () => false },
      ),
    );

    expect(
      service.dispatchResource(
        activeResource("mcpx-skills", REAL_URI, ADVERTISED_URI),
        {},
      ),
    ).toBeUndefined();
  });

  it("throws UnknownInternalCapabilityError when no handler owns the server", () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    // no handler registered for mcpx-skills this time
    expect(() =>
      service.dispatchResource(
        activeResource("mcpx-skills", REAL_URI, ADVERTISED_URI),
        {},
      ),
    ).toThrow(UnknownInternalCapabilityError);
  });
});

describe("InternalCapabilitiesService.visibleResourceForListing", () => {
  const REAL_URI = "skill://abc/SKILL.md";
  const ADVERTISED_URI = "skill://mcpx-skills/abc/SKILL.md";

  it("returns the definition when visible, undefined when hidden", () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    service.register(
      resourceHandler("mcpx-skills", () => undefined, {
        isVisible: (consumer) => consumer.consumerTag === "devs",
      }),
    );

    const cap = activeResource("mcpx-skills", REAL_URI, ADVERTISED_URI);
    expect(
      service.visibleResourceForListing(cap, { consumerTag: "devs" }),
    ).toBe(cap.definition);
    expect(
      service.visibleResourceForListing(cap, { consumerTag: "ops" }),
    ).toBeUndefined();
  });

  it("returns undefined when the handler is missing (drift)", () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    expect(
      service.visibleResourceForListing(
        activeResource("mcpx-skills", REAL_URI, ADVERTISED_URI),
        {},
      ),
    ).toBeUndefined();
  });
});

describe("InternalCapabilitiesService.visiblePromptForListing", () => {
  it("returns the definition when visible, undefined when hidden", () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    service.register(
      promptHandler("mcpx-skills", () => undefined, {
        isVisible: (consumer) => consumer.consumerTag === "devs",
      }),
    );

    const cap = activePrompt("mcpx-skills", "greet");
    expect(service.visiblePromptForListing(cap, { consumerTag: "devs" })).toBe(
      cap.definition,
    );
    expect(
      service.visiblePromptForListing(cap, { consumerTag: "ops" }),
    ).toBeUndefined();
  });

  it("returns undefined when the handler is missing (drift)", () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    expect(
      service.visiblePromptForListing(activePrompt("mcpx-skills", "greet"), {}),
    ).toBeUndefined();
  });
});

describe("InternalCapabilitiesService.dispatchPrompt", () => {
  const result: GetPromptResult = {
    messages: [{ role: "user", content: { type: "text", text: "hi" } }],
  };

  it("gets by the real prompt name", () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    let nameArg = "";
    service.register(
      promptHandler("mcpx-skills", (name) => {
        nameArg = name;
        return result;
      }),
    );

    expect(
      service.dispatchPrompt(activePrompt("mcpx-skills", "greet"), {}),
    ).toBe(result);
    expect(nameArg).toBe("greet");
  });

  it("returns undefined when the handler has no such prompt", () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    service.register(promptHandler("mcpx-skills", () => undefined));

    expect(
      service.dispatchPrompt(activePrompt("mcpx-skills", "missing"), {}),
    ).toBeUndefined();
  });

  it("returns undefined when the handler hides the prompt", () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    service.register(
      promptHandler("mcpx-skills", () => result, { isVisible: () => false }),
    );

    expect(
      service.dispatchPrompt(activePrompt("mcpx-skills", "greet"), {}),
    ).toBeUndefined();
  });

  it("throws UnknownInternalCapabilityError when no handler owns the server", () => {
    const service = new InternalCapabilitiesService(noOpLogger);
    // no handler registered for mcpx-skills this time
    expect(() =>
      service.dispatchPrompt(activePrompt("mcpx-skills", "greet"), {}),
    ).toThrow(UnknownInternalCapabilityError);
  });
});
