import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { CapabilityRegistry, tagTools } from "./capability-registry.js";
import { ActiveTool, ConsumerContext } from "./capability-resolver.js";
import {
  InternalCapabilityProvider,
  InternalToolHandler,
  InternalToolsService,
  wireInternalCapabilityProvider,
} from "./internal-tools-service.js";

function makeTool(name: string): Tool {
  return { name, inputSchema: { type: "object" as const, properties: {} } };
}

function makeHandler(toolName: string): InternalToolHandler {
  return {
    toolName,
    isVisible: () => true,
    handle: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
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
    const internalTools = new InternalToolsService(noOpLogger);
    const provider: InternalCapabilityProvider = {
      getInternalCapabilityRegistrations: () => ({
        handlers: [makeHandler("get_x")],
        eagerRegistrations: [
          {
            serverName: "mcpx",
            capabilities: {
              tools: tagTools([makeTool("get_x")], "internal"),
            },
          },
        ],
      }),
    };

    wireInternalCapabilityProvider(provider, internalTools, registry);

    expect(internalTools.hasHandler("get_x")).toBe(true);
    expect(registry.servers.get("mcpx")?.tools).toHaveLength(1);
  });

  it("throws when an eager definition has no matching handler", () => {
    const registry = new CapabilityRegistry(noOpLogger);
    const internalTools = new InternalToolsService(noOpLogger);
    const provider: InternalCapabilityProvider = {
      getInternalCapabilityRegistrations: () => ({
        handlers: [], // handler missing on purpose
        eagerRegistrations: [
          {
            serverName: "mcpx",
            capabilities: {
              tools: tagTools([makeTool("orphan")], "internal"),
            },
          },
        ],
      }),
    };

    expect(() =>
      wireInternalCapabilityProvider(provider, internalTools, registry),
    ).toThrow(/no handler/);
    // Registry must not be touched when validation fails.
    expect(registry.servers.size).toBe(0);
  });

  it("allows upstream-kind entries in eager registrations without handlers", () => {
    const registry = new CapabilityRegistry(noOpLogger);
    const internalTools = new InternalToolsService(noOpLogger);
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
      wireInternalCapabilityProvider(provider, internalTools, registry),
    ).not.toThrow();
    expect(registry.servers.get("slack")?.tools?.[0]?.origin).toBe("upstream");
  });
});

describe("InternalToolsService.visibleForListing drift detection", () => {
  it("returns undefined and logs when handler is missing", () => {
    const warn = jest.fn();
    const logger = {
      child: () => ({
        warn,
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
      }),
    } as never;
    const service = new InternalToolsService(logger);

    const result = service.visibleForListing(
      activeTool("github", "request_authentication_link"),
      {} as ConsumerContext,
    );

    expect(result).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("without a handler"),
      expect.objectContaining({
        serverName: "github",
        capabilityName: "request_authentication_link",
      }),
    );
  });
});
