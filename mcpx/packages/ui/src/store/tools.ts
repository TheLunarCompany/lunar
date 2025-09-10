import { toToolId } from "@/utils";
import {
  NextVersionAppConfig as AppConfig,
  NewToolExtension as ToolExtension,
} from "@mcpx/shared-model";
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
  createCustomTool: (tool: CustomTool) => AppConfig;
  deleteCustomTool: (tool: CustomTool) => AppConfig;
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

const toolsStore = create<ToolsStore>((set, get) => ({
  ...initialState,
  createCustomTool: (payload) => {
    const { appConfig } = socketStore.getState();

    if (!appConfig) {
      throw new Error("App config is not available.");
    }

    const { customTools } = get();
    const newCustomTools = [...customTools, payload];
    const newToolExtension: ToolExtension = {
      description: payload.description,
      name: payload.name,
      overrideParams: Object.fromEntries(
        Object.entries(payload.overrideParams).filter(
          ([, { value }]) => value !== undefined,
        ),
      ),
    };

    // Build the tool extensions structure
    const toolExtensions = { ...appConfig.toolExtensions?.services || {} };
    
    // Ensure the service exists
    if (!toolExtensions[payload.originalTool.serviceName]) {
      toolExtensions[payload.originalTool.serviceName] = {};
    }
    
    // Ensure the original tool exists
    if (!toolExtensions[payload.originalTool.serviceName][payload.originalTool.name]) {
      toolExtensions[payload.originalTool.serviceName][payload.originalTool.name] = {
        childTools: [],
      };
    }
    
    // Add the new custom tool to the child tools
    toolExtensions[payload.originalTool.serviceName][payload.originalTool.name].childTools.push(newToolExtension);

    const updates: AppConfig = {
      ...appConfig,
      toolExtensions: {
        services: toolExtensions,
      },
    };

    return updates;
  },
  deleteCustomTool: (tool) => {
    const { appConfig } = socketStore.getState();

    if (!appConfig) {
      throw new Error("App config is not available.");
    }

    const { customTools } = get();
    const newCustomTools = customTools.filter(
      (t) =>
        !(t.originalTool.id === tool.originalTool.id && t.name === tool.name),
    );

    const services = Object.fromEntries(
      Object.entries(appConfig.toolExtensions?.services || {})
        .filter(([serviceName]) =>
          newCustomTools.some(
            (t) => t.originalTool.serviceName === serviceName,
          ),
        )
        .map(([serviceName, serviceTools]) => [
          serviceName,
          Object.fromEntries(
            Object.entries(serviceTools).filter(([toolName]) =>
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
        services: newCustomTools.reduce((acc, t) => {
          const serviceTools = acc[t.originalTool.serviceName] || {};
          const existingTool = serviceTools[t.originalTool.name] || {
            childTools: [],
          };
          existingTool.childTools = existingTool.childTools.filter(
            (ct) =>
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
        }, services),
      },
    };

    return updates;
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

        customTools.push(
          ...childTools.map(({ description, name, overrideParams }) => ({
            description,
            id: toToolId(serviceName, name),
            name,
            originalTool: {
              description: originalTool.description || "",
              id: toToolId(serviceName, originalToolName),
              inputSchema: originalTool.inputSchema,
              name: originalToolName,
              serviceName,
            },
            overrideParams,
          })),
        );
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

    const toolExtensions = { ...appConfig.toolExtensions?.services || {} };
    
    // Ensure the service exists
    if (!toolExtensions[tool.originalTool.serviceName]) {
      toolExtensions[tool.originalTool.serviceName] = {};
    }
    
    // Ensure the original tool exists
    if (!toolExtensions[tool.originalTool.serviceName][tool.originalTool.name]) {
      toolExtensions[tool.originalTool.serviceName][tool.originalTool.name] = {
        childTools: [],
      };
    }
    
    // Find and update the existing custom tool
    const childTools = toolExtensions[tool.originalTool.serviceName][tool.originalTool.name].childTools;
    
    // For edit mode, we need to find the tool by the original name, not the new name
    // because the user might be changing the name
    const toolIndex = childTools.findIndex((ct: any) => {
      // Use originalName if available (for edit mode), otherwise use current name
      const lookupName = tool.originalName || tool.name;
      return ct.name === lookupName;
    });
    
    
    if (toolIndex >= 0) {
      childTools[toolIndex] = {
        description: tool.description,
        name: tool.name,
        overrideParams: Object.fromEntries(
          Object.entries(tool.overrideParams).filter(
            ([, value]) => value !== undefined,
          ),
        ),
      };  
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
  toolsStore.getState().init(state);
});

export const useToolsStore = <T>(selector: (state: ToolsStore) => T) =>
  toolsStore(useShallow(selector));

export const initToolsStore = () => {
  toolsStore.getState().init(socketStore.getState());
};
