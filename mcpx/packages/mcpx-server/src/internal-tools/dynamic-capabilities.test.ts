import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  DynamicCapabilitiesService,
  InternalToolName,
} from "./dynamic-capabilities.js";
import { INTERNAL_SERVICE_NAME } from "../model/internal-service.js";
import { ControlPlaneConfigService } from "../services/control-plane-config-service.js";
import { AlreadyExistsError, NotFoundError } from "../errors.js";
import { ToolGroup } from "../model/config/permissions.js";
import { LLMService, MatchedTool, AvailableToolInfo } from "./llm-service.js";
import {
  CapabilityRegistry,
  tagTools,
} from "../services/capability-registry.js";
import { CapabilityResolver } from "../services/capability-resolver.js";
import { CatalogManagerI } from "../services/catalog-manager.js";

type ConsumerConfig = { _type: string; allow?: string[] };

interface ConfigState {
  toolGroups: ToolGroup[];
  consumers: Record<string, ConsumerConfig>;
}

// Stub with only the methods DynamicCapabilitiesService actually calls
function createConfigService(state: ConfigState): ControlPlaneConfigService {
  return {
    getConfig: () => ({
      toolGroups: state.toolGroups,
      permissions: {
        default: { _type: "default-block", allow: [] },
        consumers: state.consumers,
      },
      targetServerAttributes: {},
    }),
    addToolGroup: async ({ group }: { group: ToolGroup }) => {
      if (state.toolGroups.some((g) => g.name === group.name)) {
        throw new AlreadyExistsError();
      }
      state.toolGroups.push(group);
    },
    updateToolGroup: async ({
      name,
      updates,
    }: {
      name: string;
      updates: ToolGroup;
    }) => {
      const idx = state.toolGroups.findIndex((g) => g.name === name);
      if (idx === -1) throw new NotFoundError();
      state.toolGroups[idx] = { ...state.toolGroups[idx], ...updates };
    },
    deleteToolGroup: async ({ name }: { name: string }) => {
      const idx = state.toolGroups.findIndex((g) => g.name === name);
      if (idx === -1) throw new NotFoundError();
      state.toolGroups.splice(idx, 1);
    },
    getPermissionConsumer: ({ name }: { name: string }) =>
      state.consumers[name],
    addPermissionConsumer: async ({
      name,
      config,
    }: {
      name: string;
      config: ConsumerConfig;
    }) => {
      state.consumers[name] = config;
    },
    updatePermissionConsumer: async ({
      name,
      config,
    }: {
      name: string;
      config: ConsumerConfig;
    }) => {
      state.consumers[name] = config;
    },
    deletePermissionConsumer: async ({ name }: { name: string }) => {
      if (!state.consumers[name]) throw new NotFoundError();
      delete state.consumers[name];
    },
  } as unknown as ControlPlaneConfigService;
}

function makeTool(name: string): Tool {
  return { name, inputSchema: { type: "object" as const, properties: {} } };
}

function createRegistry(tools?: Record<string, Tool[]>): CapabilityRegistry {
  const r = new CapabilityRegistry(noOpLogger);
  if (tools) {
    for (const [serverName, serverTools] of Object.entries(tools)) {
      r.registerServer(serverName, {
        tools: tagTools(serverTools, "upstream"),
      });
    }
  }
  return r;
}

// Stub that returns the provided matched tools for any intent
function createLLMService(matchedTools: MatchedTool[]): LLMService {
  return {
    matchToolsForIntent: async (_intent: string, _tools: AvailableToolInfo[]) =>
      matchedTools,
  };
}

function createResolver(registry: CapabilityRegistry): CapabilityResolver {
  const catalogStub = {
    isToolApproved: () => true,
    isStrict: () => false,
    isServerApproved: () => true,
    subscribe: () => () => {},
  } as unknown as CatalogManagerI;
  const permissionsStub = { hasPermission: () => true };
  return new CapabilityResolver(
    registry,
    catalogStub,
    permissionsStub,
    noOpLogger,
  );
}

function createService(
  state: ConfigState,
  llmService: LLMService,
  registry: CapabilityRegistry = createRegistry(),
): DynamicCapabilitiesService {
  return new DynamicCapabilitiesService(
    createConfigService(state),
    llmService,
    createResolver(registry),
    noOpLogger,
  );
}

describe("DynamicCapabilitiesService", () => {
  describe("initializeDynamicCapabilities", () => {
    it("creates dynamic tool group with owner field and consumer permission", async () => {
      const state: ConfigState = { toolGroups: [], consumers: {} };
      const service = createService(state, createLLMService([]));

      await service.initializeDynamicCapabilities("my-consumer");

      expect(state.toolGroups).toHaveLength(1);
      expect(state.toolGroups[0]?.name).toBe("my-consumer_dynamic");
      expect(state.toolGroups[0]?.services).toEqual({
        [INTERNAL_SERVICE_NAME]: "*",
      });
      expect(state.toolGroups[0]?.owner).toBe("dynamic-capabilities");
      expect(state.consumers["my-consumer"]).toEqual({
        _type: "default-block",
        allow: ["my-consumer_dynamic"],
      });
    });

    it("resets existing dynamic group on AlreadyExistsError", async () => {
      const state: ConfigState = {
        toolGroups: [
          { name: "my-consumer_dynamic", services: { slack: ["post"] } },
        ],
        consumers: {},
      };
      const service = createService(state, createLLMService([]));

      await service.initializeDynamicCapabilities("my-consumer");

      expect(state.toolGroups).toHaveLength(1);
      expect(state.toolGroups[0]?.services).toEqual({
        [INTERNAL_SERVICE_NAME]: "*",
      });
    });
  });

  describe("cleanupDynamicCapabilities", () => {
    it("removes consumer and tool group", async () => {
      const state: ConfigState = {
        toolGroups: [
          {
            name: "my-consumer_dynamic",
            services: { [INTERNAL_SERVICE_NAME]: "*" },
          },
        ],
        consumers: { "my-consumer": { _type: "default-block", allow: [] } },
      };
      const service = createService(state, createLLMService([]));

      await service.cleanupDynamicCapabilities("my-consumer");

      expect(state.toolGroups).toHaveLength(0);
      expect(state.consumers["my-consumer"]).toBeUndefined();
    });

    it("handles NotFoundError gracefully", async () => {
      const state: ConfigState = { toolGroups: [], consumers: {} };
      const service = createService(state, createLLMService([]));

      // Should not throw
      await service.cleanupDynamicCapabilities("nonexistent");
    });
  });

  describe("isDynamicCapabilitiesEnabled", () => {
    it("returns true when dynamic group exists", async () => {
      const state: ConfigState = { toolGroups: [], consumers: {} };
      const service = createService(state, createLLMService([]));

      await service.initializeDynamicCapabilities("my-consumer");

      expect(service.isDynamicCapabilitiesEnabled("my-consumer")).toBe(true);
    });

    it("returns false when dynamic group does not exist", () => {
      const state: ConfigState = { toolGroups: [], consumers: {} };
      const service = createService(state, createLLMService([]));

      expect(service.isDynamicCapabilitiesEnabled("my-consumer")).toBe(false);
    });
  });

  describe("getInternalCapabilityRegistrations", () => {
    it("returns handlers and one eager registration for the internal service", () => {
      const state: ConfigState = { toolGroups: [], consumers: {} };
      const service = createService(state, createLLMService([]));

      const { handlers, eagerRegistrations } =
        service.getInternalCapabilityRegistrations();
      const names = handlers.map((h) => h.name);
      expect(names).toContain("get_new_capabilities");
      expect(names).toContain("clear_tools");
      expect(handlers).toHaveLength(2);
      expect(eagerRegistrations).toHaveLength(1);
      const registered = eagerRegistrations[0];
      expect(registered?.serverName).toBe(INTERNAL_SERVICE_NAME);
      const registeredTools = registered?.capabilities.tools ?? [];
      expect(registeredTools.map((t) => t.definition.name)).toEqual([
        "get_new_capabilities",
        "clear_tools",
      ]);
      expect(registeredTools.every((t) => t.origin === "internal")).toBe(true);
    });

    it("handlers are invisible when consumer lacks dynamic mode", () => {
      const state: ConfigState = { toolGroups: [], consumers: {} };
      const service = createService(state, createLLMService([]));

      const handler = service
        .getInternalCapabilityRegistrations()
        .handlers.find((h) => h.name === "get_new_capabilities");
      expect(
        handler?.isVisible(
          { consumerTag: "no-mode" },
          {
            serverName: "mcpx",
            capabilityName: "get_new_capabilities",
            definition: {
              name: "mcpx__get_new_capabilities",
              inputSchema: { type: "object" },
            },
            origin: "internal",
          },
        ),
      ).toBe(false);
    });
  });

  describe("handleToolCall", () => {
    describe("get_new_capabilities", () => {
      it("returns error when intent is missing", async () => {
        const state: ConfigState = { toolGroups: [], consumers: {} };
        const service = createService(state, createLLMService([]));
        await service.initializeDynamicCapabilities("my-consumer");

        const result = await service.handleToolCall({
          consumerTag: "my-consumer",
          toolName: InternalToolName.GET_NEW_CAPABILITIES,
          args: {},
        });

        expect(result.isError).toBe(true);
        expect((result.content[0] as { text: string }).text).toContain(
          "intent",
        );
      });

      it("updates tool group with matched tools", async () => {
        const state: ConfigState = { toolGroups: [], consumers: {} };
        const matched: MatchedTool[] = [
          { serverName: "slack", toolName: "post" },
        ];
        const registry = createRegistry({ slack: [makeTool("post")] });
        const service = createService(
          state,
          createLLMService(matched),
          registry,
        );
        await service.initializeDynamicCapabilities("my-consumer");

        const result = await service.handleToolCall({
          consumerTag: "my-consumer",
          toolName: InternalToolName.GET_NEW_CAPABILITIES,
          args: { intent: "post to slack" },
        });

        expect(result.isError).toBeUndefined();
        expect(state.toolGroups[0]?.services).toEqual({
          [INTERNAL_SERVICE_NAME]: "*",
          slack: ["post"],
        });
      });
    });

    describe("clear_tools", () => {
      it("resets tool group to internal only", async () => {
        const state: ConfigState = { toolGroups: [], consumers: {} };
        const matched: MatchedTool[] = [
          { serverName: "slack", toolName: "post" },
        ];
        const registry = createRegistry({ slack: [makeTool("post")] });
        const service = createService(
          state,
          createLLMService(matched),
          registry,
        );
        await service.initializeDynamicCapabilities("my-consumer");

        // Add tools via get_new_capabilities
        await service.handleToolCall({
          consumerTag: "my-consumer",
          toolName: InternalToolName.GET_NEW_CAPABILITIES,
          args: { intent: "post to slack" },
        });
        expect(state.toolGroups[0]?.services).toEqual({
          [INTERNAL_SERVICE_NAME]: "*",
          slack: ["post"],
        });

        // Clear tools
        const result = await service.handleToolCall({
          consumerTag: "my-consumer",
          toolName: InternalToolName.CLEAR_TOOLS,
          args: {},
        });

        expect(result.isError).toBeUndefined();
        expect(state.toolGroups[0]?.services).toEqual({
          [INTERNAL_SERVICE_NAME]: "*",
        });
      });
    });
  });

  describe("initialize", () => {
    it("removes stale dynamic-capabilities groups based on owner field", async () => {
      const state: ConfigState = {
        toolGroups: [
          {
            name: "stale_dynamic",
            services: {},
            owner: "dynamic-capabilities",
          },
          { name: "regular-group", services: { slack: "*" } },
          { name: "user_dynamic", services: {}, owner: "user" },
        ],
        consumers: {},
      };
      const service = createService(state, createLLMService([]));

      await service.initialize();

      expect(state.toolGroups).toHaveLength(2);
      expect(state.toolGroups.map((g) => g.name)).toEqual([
        "regular-group",
        "user_dynamic",
      ]);
    });

    it("removes stale consumers whose allow-list references a dynamic group", async () => {
      // Mirrors what initializeDynamicCapabilities writes at runtime: a
      // default-block consumer with allow=[dynamic group name] and no
      // consumerGroupKey. These survived restarts before the fix.
      const state: ConfigState = {
        toolGroups: [
          {
            name: "alice_dynamic",
            services: {},
            owner: "dynamic-capabilities",
          },
        ],
        consumers: {
          alice: { _type: "default-block", allow: ["alice_dynamic"] },
          bob: { _type: "default-block", allow: ["some-other-group"] },
        },
      };
      const service = createService(state, createLLMService([]));

      await service.initialize();

      expect(state.consumers["alice"]).toBeUndefined();
      // Unrelated consumers must not be touched.
      expect(state.consumers["bob"]).toBeDefined();
      // The dynamic tool group itself is removed too.
      expect(state.toolGroups).toHaveLength(0);
    });
  });
});
