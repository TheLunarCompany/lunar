import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  DynamicCapabilitiesService,
  INTERNAL_SERVICE_NAME,
  InternalToolName,
} from "./dynamic-capabilities.js";
import { ControlPlaneConfigService } from "../services/control-plane-config-service.js";
import { UpstreamHandler } from "../services/upstream-handler.js";
import { AlreadyExistsError, NotFoundError } from "../errors.js";
import { ToolGroup } from "../model/config/permissions.js";
import { LLMService, MatchedTool, AvailableToolInfo } from "./llm-service.js";

type ConsumerConfig = { _type: string; allow?: string[]; block?: string[] };

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

// Stub with only the methods DynamicCapabilitiesService actually calls
function createUpstreamHandler(
  servers: Map<
    string,
    { tools: Array<{ name: string; description?: string }> }
  >,
): UpstreamHandler {
  const clients = new Map<string, Client>();
  for (const name of servers.keys()) {
    clients.set(name, {
      getServerCapabilities: () => ({ tools: {} }),
    } as unknown as Client);
  }
  return {
    connectedClientsByService: clients,
    listTools: async (name: string) => {
      const server = servers.get(name);
      if (!server) throw new Error(`Server ${name} not found`);
      return { tools: server.tools };
    },
  } as unknown as UpstreamHandler;
}

// Stub that returns the provided matched tools for any intent
function createLLMService(matchedTools: MatchedTool[]): LLMService {
  return {
    matchToolsForIntent: async (_intent: string, _tools: AvailableToolInfo[]) =>
      matchedTools,
  };
}

describe("DynamicCapabilitiesService", () => {
  describe("getInternalTools", () => {
    it("returns tools prefixed with internal service name", () => {
      const state: ConfigState = { toolGroups: [], consumers: {} };
      const service = new DynamicCapabilitiesService(
        createConfigService(state),
        createUpstreamHandler(new Map()),
        createLLMService([]),
        noOpLogger,
      );

      const tools = service.getInternalTools();
      const toolNames = tools.map((t) => t.name);

      expect(tools).toHaveLength(2);
      expect(toolNames).toContain(
        `${INTERNAL_SERVICE_NAME}__get_new_capabilities`,
      );
      expect(toolNames).toContain(`${INTERNAL_SERVICE_NAME}__clear_tools`);
    });

    it("includes server names in description when servers connected", () => {
      const state: ConfigState = { toolGroups: [], consumers: {} };
      const servers = new Map([
        ["slack", { tools: [] }],
        ["github", { tools: [] }],
      ]);
      const service = new DynamicCapabilitiesService(
        createConfigService(state),
        createUpstreamHandler(servers),
        createLLMService([]),
        noOpLogger,
      );

      const tools = service.getInternalTools();
      const getCapabilitiesTool = tools.find(
        (t) => t.name === `${INTERNAL_SERVICE_NAME}__get_new_capabilities`,
      );

      expect(getCapabilitiesTool?.description).toContain("Available servers:");
      expect(getCapabilitiesTool?.description).toContain("github");
      expect(getCapabilitiesTool?.description).toContain("slack");
    });
  });

  describe("initializeDynamicCapabilities", () => {
    it("creates dynamic tool group with owner field and consumer permission", async () => {
      const state: ConfigState = { toolGroups: [], consumers: {} };
      const service = new DynamicCapabilitiesService(
        createConfigService(state),
        createUpstreamHandler(new Map()),
        createLLMService([]),
        noOpLogger,
      );

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
      const service = new DynamicCapabilitiesService(
        createConfigService(state),
        createUpstreamHandler(new Map()),
        createLLMService([]),
        noOpLogger,
      );

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
      const service = new DynamicCapabilitiesService(
        createConfigService(state),
        createUpstreamHandler(new Map()),
        createLLMService([]),
        noOpLogger,
      );

      await service.cleanupDynamicCapabilities("my-consumer");

      expect(state.toolGroups).toHaveLength(0);
      expect(state.consumers["my-consumer"]).toBeUndefined();
    });

    it("handles NotFoundError gracefully", async () => {
      const state: ConfigState = { toolGroups: [], consumers: {} };
      const service = new DynamicCapabilitiesService(
        createConfigService(state),
        createUpstreamHandler(new Map()),
        createLLMService([]),
        noOpLogger,
      );

      // Should not throw
      await service.cleanupDynamicCapabilities("nonexistent");
    });
  });

  describe("isDynamicCapabilitiesEnabled", () => {
    it("returns true when dynamic group exists", async () => {
      const state: ConfigState = { toolGroups: [], consumers: {} };
      const service = new DynamicCapabilitiesService(
        createConfigService(state),
        createUpstreamHandler(new Map()),
        createLLMService([]),
        noOpLogger,
      );

      await service.initializeDynamicCapabilities("my-consumer");

      expect(service.isDynamicCapabilitiesEnabled("my-consumer")).toBe(true);
    });

    it("returns false when dynamic group does not exist", () => {
      const state: ConfigState = { toolGroups: [], consumers: {} };
      const service = new DynamicCapabilitiesService(
        createConfigService(state),
        createUpstreamHandler(new Map()),
        createLLMService([]),
        noOpLogger,
      );

      expect(service.isDynamicCapabilitiesEnabled("my-consumer")).toBe(false);
    });
  });

  describe("isInternalTool", () => {
    it("returns true for internal tools", () => {
      const state: ConfigState = { toolGroups: [], consumers: {} };
      const service = new DynamicCapabilitiesService(
        createConfigService(state),
        createUpstreamHandler(new Map()),
        createLLMService([]),
        noOpLogger,
      );

      expect(service.isInternalTool("get_new_capabilities")).toBe(true);
      expect(service.isInternalTool("clear_tools")).toBe(true);
      expect(service.isInternalTool("unknown")).toBe(false);
    });
  });

  describe("handleToolCall", () => {
    describe("get_new_capabilities", () => {
      it("returns error when intent is missing", async () => {
        const state: ConfigState = { toolGroups: [], consumers: {} };
        const service = new DynamicCapabilitiesService(
          createConfigService(state),
          createUpstreamHandler(new Map()),
          createLLMService([]),
          noOpLogger,
        );
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
        const servers = new Map([["slack", { tools: [{ name: "post" }] }]]);
        const matched: MatchedTool[] = [
          { serverName: "slack", toolName: "post" },
        ];
        const service = new DynamicCapabilitiesService(
          createConfigService(state),
          createUpstreamHandler(servers),
          createLLMService(matched),
          noOpLogger,
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
        const servers = new Map([["slack", { tools: [{ name: "post" }] }]]);
        const matched: MatchedTool[] = [
          { serverName: "slack", toolName: "post" },
        ];
        const service = new DynamicCapabilitiesService(
          createConfigService(state),
          createUpstreamHandler(servers),
          createLLMService(matched),
          noOpLogger,
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
      const service = new DynamicCapabilitiesService(
        createConfigService(state),
        createUpstreamHandler(new Map()),
        createLLMService([]),
        noOpLogger,
      );

      await service.initialize();

      expect(state.toolGroups).toHaveLength(2);
      expect(state.toolGroups.map((g) => g.name)).toEqual([
        "regular-group",
        "user_dynamic",
      ]);
    });
  });
});
