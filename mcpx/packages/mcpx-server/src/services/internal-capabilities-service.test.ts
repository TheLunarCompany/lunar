import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { CapabilityRegistry, tagTools } from "./capability-registry.js";
import { ActiveTool, ConsumerContext } from "./capability-resolver.js";
import {
  HiddenInternalCapabilityError,
  InternalCapabilitiesService,
  InternalCapabilityProvider,
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
