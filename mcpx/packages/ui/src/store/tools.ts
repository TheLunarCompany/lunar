import { toToolId } from "@/utils";
import { AppConfig, ToolExtension } from "@mcpx/shared-model";
import { TargetServerTool } from "@mcpx/shared-model/api";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { SocketStore, socketStore } from "./socket";

export interface ServerTool {
  description?: string;
  id: string;
  inputSchema?: TargetServerTool["inputSchema"];
  name: string;
  serviceName: string;
}
export interface CustomTool {
  description?: {
    action: "append" | "rewrite";
    text: string;
  };
  name: string;
  originalName?: string;
  originalTool: ServerTool;
  overrideParams: ToolExtension["overrideParams"];
}
export interface ToolsState {
  customTools: CustomTool[];
  tools: ServerTool[];
}
export interface ToolsActions {
  createCustomTool: (tool: CustomTool) => Promise<AppConfig>;
  deleteCustomTool: (tool: CustomTool) => Promise<AppConfig>;
  init: (socketStoreState: SocketStore) => void;
  setTools: (
    update:
      | ToolsState["tools"]
      | ((tools: ToolsState["tools"]) => ToolsState["tools"]),
  ) => void;
  updateCustomTool: (tool: CustomTool) => AppConfig;
}
export type ToolsStore = ToolsState & ToolsActions;

const initialState: ToolsState = { customTools: [], tools: [] };

// Helper to wait for appConfig to be available
async function waitForAppConfig(
  maxAttempts = 20,
  delay = 50,
): Promise<AppConfig | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const { appConfig } = socketStore.getState();
    if (appConfig) {
      return appConfig;
    }
    // Wait using a Promise
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Final attempt
  const finalAppConfig = socketStore.getState().appConfig;
  if (!finalAppConfig) {
    console.error("[Tools] appConfig still not available after max attempts");
  }
  return finalAppConfig;
}

// Extended type for tool extensions with childTools
type ToolExtensionWithChildren = Partial<ToolExtension> & {
  childTools?: ToolExtension[];
};

function createCustomToolImpl(
  payload: CustomTool,
  appConfig: AppConfig,
): AppConfig {
  const newToolExtension: ToolExtension = {
    description: payload.description,
    name: payload.name,
    overrideParams: Object.fromEntries(
      Object.entries(payload.overrideParams).filter(
        ([, value]) => value !== undefined,
      ),
    ) as ToolExtension["overrideParams"],
  };

  // Build the tool extensions structure
  const toolExtensions = {
    ...(appConfig.toolExtensions?.services || {}),
  } as Record<string, Record<string, ToolExtensionWithChildren>>;

  // Ensure the service exists
  if (!toolExtensions[payload.originalTool.serviceName]) {
    toolExtensions[payload.originalTool.serviceName] = {};
  }

  // Ensure the original tool exists
  if (
    !toolExtensions[payload.originalTool.serviceName][payload.originalTool.name]
  ) {
    toolExtensions[payload.originalTool.serviceName][
      payload.originalTool.name
    ] = {
      childTools: [],
    } as ToolExtensionWithChildren;
  }

  // Add the new custom tool to the child tools
  const toolExt =
    toolExtensions[payload.originalTool.serviceName][payload.originalTool.name];
  if (!toolExt.childTools) {
    toolExt.childTools = [];
  }
  toolExt.childTools.push(newToolExtension);

  const updates: AppConfig = {
    ...appConfig,
    toolExtensions: {
      services: toolExtensions as AppConfig["toolExtensions"]["services"],
    },
  };

  return updates;
}

function deleteCustomToolImpl(
  tool: CustomTool,
  appConfig: AppConfig,
  customTools: CustomTool[],
): AppConfig {
  const newCustomTools = customTools.filter(
    (t) =>
      !(t.originalTool.id === tool.originalTool.id && t.name === tool.name),
  );

  type ServiceToolsMap = Record<
    string,
    Record<string, ToolExtensionWithChildren>
  >;

  const services: ServiceToolsMap = Object.fromEntries(
    Object.entries(
      (appConfig.toolExtensions?.services || {}) as ServiceToolsMap,
    )
      .filter(([serviceName]) =>
        newCustomTools.some((t) => t.originalTool.serviceName === serviceName),
      )
      .map(([serviceName, serviceTools]) => [
        serviceName,
        Object.fromEntries(
          Object.entries(
            serviceTools as Record<string, ToolExtensionWithChildren>,
          ).filter(([toolName]) =>
            newCustomTools.some(
              (t) =>
                t.originalTool.name === toolName &&
                t.originalTool.serviceName === serviceName,
            ),
          ),
        ),
      ]),
  );

  const updates: AppConfig = {
    ...appConfig,
    toolExtensions: {
      services: newCustomTools.reduce((acc: ServiceToolsMap, t) => {
        const serviceTools = acc[t.originalTool.serviceName] || {};
        const existingTool: ToolExtensionWithChildren = serviceTools[
          t.originalTool.name
        ] || {
          childTools: [],
        };
        existingTool.childTools = (existingTool.childTools || []).filter(
          (ct: ToolExtension) =>
            !(
              t.originalTool.id === tool.originalTool.id &&
              ct.name === tool.name
            ),
        );

        if (existingTool.childTools.length > 0) {
          serviceTools[t.originalTool.name] = existingTool;
        } else {
          delete serviceTools[t.originalTool.name];
        }

        acc[t.originalTool.serviceName] = serviceTools;

        return acc;
      }, services) as AppConfig["toolExtensions"]["services"],
    },
  };

  return updates;
}

const toolsStore = create<ToolsStore>((set, get) => ({
  ...initialState,
  createCustomTool: async (payload) => {
    const appConfig = await waitForAppConfig();

    if (!appConfig) {
      throw new Error("App config is not available.");
    }

    return createCustomToolImpl(payload, appConfig);
  },

  deleteCustomTool: async (tool) => {
    const appConfig = await waitForAppConfig();

    if (!appConfig) {
      throw new Error("App config is not available.");
    }

    const { customTools } = get();
    return deleteCustomToolImpl(tool, appConfig, customTools);
  },
  init: (socketStoreState: SocketStore) => {
    if (!socketStoreState.systemState || !socketStoreState.appConfig) {
      return;
    }

    const { systemState, appConfig } = socketStoreState;

    const customTools: CustomTool[] = [];

    for (const [serviceName, serviceTools] of Object.entries(
      appConfig.toolExtensions?.services || {},
    )) {
      // TODO: Maybe populate custom tools regardless of the service tools?
      for (const [originalToolName, { childTools }] of Object.entries(
        serviceTools,
      )) {
        const originalTool = systemState.targetServers_new
          .find((server) => server.name === serviceName)
          ?.originalTools.find((tool) => tool.name === originalToolName);

        if (!originalTool) {
          continue;
        }

        const toolsForService = childTools.map(
          (toolExtension: ToolExtension) => {
            const parameterDescriptions = Object.fromEntries(
              Object.entries(toolExtension.overrideParams || {})
                .map(([name, param]) => {
                  const descObject = param?.description;
                  if (!descObject || typeof descObject.text !== "string") {
                    return [name, undefined];
                  }

                  const text = descObject.text.trim();
                  if (!text) {
                    return [name, undefined];
                  }

                  return [name, text];
                })
                .filter(([, text]) => text !== undefined),
            );

            return {
              description: toolExtension.description,
              id: toToolId(serviceName, toolExtension.name),
              name: toolExtension.name,
              originalTool: {
                description: originalTool.description || "",
                id: toToolId(serviceName, originalToolName),
                inputSchema: originalTool.inputSchema,
                name: originalToolName,
                serviceName,
              },
              overrideParams: toolExtension.overrideParams,
              parameterDescriptions,
            };
          },
        );

        customTools.push(...toolsForService);
      }
    }

    const tools: ToolsState["tools"] = [];

    for (const targetServer of systemState.targetServers_new) {
      const serviceName = targetServer.name;
      for (const {
        description,
        name,
        inputSchema,
      } of targetServer.originalTools) {
        const id = toToolId(serviceName, name);
        tools.push({
          description,
          id,
          inputSchema,
          name,
          serviceName,
        });
      }
    }

    set({ customTools, tools });
  },
  setTools: (update) => {
    set((state) => ({
      tools: typeof update === "function" ? update(state.tools) : update,
    }));
  },
  updateCustomTool: (tool) => {
    const { appConfig } = socketStore.getState();

    if (!appConfig) {
      throw new Error("App config is not available.");
    }

    const toolExtensions = { ...(appConfig.toolExtensions?.services || {}) };

    // Ensure the service exists
    if (!toolExtensions[tool.originalTool.serviceName]) {
      toolExtensions[tool.originalTool.serviceName] = {};
    }

    // Ensure the original tool exists
    if (
      !toolExtensions[tool.originalTool.serviceName][tool.originalTool.name]
    ) {
      toolExtensions[tool.originalTool.serviceName][tool.originalTool.name] = {
        childTools: [],
      };
    }

    // Find and update the existing custom tool
    const childTools =
      toolExtensions[tool.originalTool.serviceName][tool.originalTool.name]
        .childTools;

    // For edit mode, we need to find the tool by the original name, not the new name
    // because the user might be changing the name
    const lookupName = tool.originalName || tool.name;
    const toolIndex = childTools.findIndex((ct: ToolExtension) => {
      // Use originalName if available (for edit mode), otherwise use current name
      return ct.name === lookupName;
    });

    if (toolIndex >= 0) {
      const updatedTool: ToolExtension = {
        description: tool.description,
        name: tool.name,
        overrideParams: Object.fromEntries(
          Object.entries(tool.overrideParams).filter(
            ([, value]) => value !== undefined,
          ),
        ),
      };

      childTools[toolIndex] = updatedTool;
    } else {
      // Tool not found, this shouldn't happen in edit mode
    }

    const updates: AppConfig = {
      ...appConfig,
      toolExtensions: {
        services: toolExtensions,
      },
    };

    return updates;
  },
}));

// Subscribe to socket store updates to keep tools state
// in sync with the app configuration and system state.
socketStore.subscribe((state) => {
  // Only update if there are no pending operations (to prevent overwriting optimistic updates)
  toolsStore.getState().init(state);
});

export const useToolsStore = <T>(selector: (state: ToolsStore) => T) =>
  toolsStore(useShallow(selector));

export { toolsStore };

export const initToolsStore = () => {
  toolsStore.getState().init(socketStore.getState());
};
