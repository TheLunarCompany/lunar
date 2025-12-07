import {
  AppConfig,
  ConsumerConfig,
} from "@mcpx/shared-model";
import { diff } from "json-diff-ts";
import sortBy from "lodash/sortBy";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { SocketStore, socketStore } from "./socket";

export const PermissionEnum = {
  Allow: "allow",
  Block: "block",
  AllowAll: "allow-all",
  BlockAll: "block-all",
} as const;

export type Permission = (typeof PermissionEnum)[keyof typeof PermissionEnum];
export type AgentProfile = {
  id: string;
  name: string;
  permission: Permission;
  agents: string[];
  toolGroups: string[];
};
export type ToolGroup = {
  id: string;
  name: string;
  description?: string;
  services: {
    [serviceName: string]: string[];
  };
};
export interface AccessControlsState {
  agentsList: string[];
  appConfigUpdates: AppConfig | null;
  hasPendingChanges: boolean;
  profiles: AgentProfile[];
  toolGroupModalData?: ToolGroup;
  toolGroups: ToolGroup[];
}
export interface AccessControlsActions {
  init: (socketStoreState: SocketStore) => void;
  resetAppConfigUpdates: () => void;
  setAgentsList: (
    profiles: string[] | ((profiles: string[]) => string[]),
  ) => void;
  setAppConfigUpdates: () => void;
  setProfiles: ((
    updater: (profiles: AgentProfile[]) => AgentProfile[],
    skipConfigUpdate?: boolean,
  ) => void) &
    ((profiles: AgentProfile[], skipConfigUpdate?: boolean) => void);
  setToolGroups: ((updater: (groups: ToolGroup[]) => ToolGroup[]) => void) &
    ((groups: ToolGroup[]) => void);
}
export type AccessControlsStore = AccessControlsState & AccessControlsActions;

export const DEFAULT_PROFILE_NAME = "default";

const initialState: AccessControlsState = {
  agentsList: [],
  appConfigUpdates: null,
  hasPendingChanges: false,
  profiles: [],
  toolGroups: [],
};

const accessControlsStore = create<AccessControlsStore>((set, get) => ({
  ...initialState,
  init: (socketStoreState: SocketStore) => {
    if (!socketStoreState.systemState || !socketStoreState.appConfig) {
      return;
    }

    // Get agent list from connected clients, using consumerTag if available, otherwise fall back to cluster name
    const agentsList = sortBy(
      [
        ...new Set(
          socketStoreState.systemState?.connectedClientClusters?.flatMap(
            (cluster) => {
              // Get the actual consumer tags from the connected clients
              const consumerTags = cluster.sessionIds
                .map((sessionId) => {
                  const session =
                    socketStoreState.systemState?.connectedClients?.find(
                      (client) => client.sessionId === sessionId,
                    );
                  return session?.consumerTag;
                })
                .filter(Boolean) as string[];

              // If we have consumer tags, use them; otherwise fall back to cluster name
              return consumerTags.length > 0 ? consumerTags : [cluster.name];
            },
          ) || [],
        ),
      ],
      (agent) => agent.toLowerCase(),
    );

    const mcpServers =
      socketStoreState.systemState?.targetServers_new?.map((server) => ({
        name: server.name,
        tools: server.tools.map((tool) => tool.name),
      })) || [];

    const toolGroups = socketStoreState.appConfig?.toolGroups.map(
      ({ name, services, description }, index) => ({
        id: `tool_group_${index}`,
        name,
        description: description || "",
        services: Object.fromEntries(
          sortBy(
            Object.entries(services).map(([serviceName, tools]) => [
              serviceName,
              tools === "*"
                ? mcpServers.find((server) => server.name === serviceName)
                    ?.tools || []
                : tools,
            ]),
            ([key]) => key.toLowerCase(),
          ),
        ),
      }),
    );

    let profilesCounter = 0;

    const defaultProfilePermission =
      socketStoreState.appConfig?.permissions.default._type === "default-allow"
        ? "block" in socketStoreState.appConfig.permissions.default &&
          Array.isArray(socketStoreState.appConfig.permissions.default.block) &&
          socketStoreState.appConfig.permissions.default.block.length > 0
          ? PermissionEnum.Block
          : PermissionEnum.AllowAll
        : "allow" in socketStoreState.appConfig.permissions.default &&
            Array.isArray(
              socketStoreState.appConfig.permissions.default.allow,
            ) &&
            socketStoreState.appConfig.permissions.default.allow.length > 0
          ? PermissionEnum.Allow
          : PermissionEnum.BlockAll;

    const defaultProfile: AgentProfile = {
      id: `profile_${profilesCounter++}`,
      name: DEFAULT_PROFILE_NAME,
      permission: defaultProfilePermission,
      agents: agentsList,
      toolGroups: sortBy(
        socketStoreState.appConfig?.permissions.default._type ===
          "default-allow"
          ? "block" in socketStoreState.appConfig.permissions.default &&
            Array.isArray(socketStoreState.appConfig.permissions.default.block)
            ? socketStoreState.appConfig.permissions.default.block
            : []
          : "allow" in socketStoreState.appConfig.permissions.default &&
              Array.isArray(
                socketStoreState.appConfig.permissions.default.allow,
              )
            ? socketStoreState.appConfig.permissions.default.allow
            : [],
        (group) => group.toLowerCase(),
      )
        .map((group) => toolGroups.find((g) => g.name === group)?.id || "")
        .filter(Boolean),
    };

    // Group consumers by their consumerGroupKey to create profiles
    const consumerGroups = new Map<
      string,
      { consumers: string[]; config: ConsumerConfig }
    >();

    if (socketStoreState.appConfig?.permissions.consumers) {
      Object.entries(socketStoreState.appConfig.permissions.consumers).forEach(
        ([consumerName, config]) => {
          if (
            !config.consumerGroupKey ||
            config.consumerGroupKey === DEFAULT_PROFILE_NAME
          ) {
            return;
          }

          if (!consumerGroups.has(config.consumerGroupKey)) {
            consumerGroups.set(config.consumerGroupKey, {
              consumers: [],
              config,
            });
          }

          consumerGroups
            .get(config.consumerGroupKey)!
            .consumers.push(consumerName);
        },
      );
    }

    const profiles = Array.from(consumerGroups.entries()).map(
      ([groupName, { consumers, config }]) => {
        let permission: Permission;

        // Determine permission based on array contents only
        if (
          "allow" in config &&
          Array.isArray(config.allow) &&
          config.allow.length > 0
        ) {
          // Has allow rules = Allow profile
          permission = PermissionEnum.Allow;
        } else if (
          "block" in config &&
          Array.isArray(config.block) &&
          config.block.length > 0
        ) {
          // Has block rules = Block profile
          permission = PermissionEnum.Block;
        } else if (
          "allow" in config &&
          Array.isArray(config.allow) &&
          config.allow.length === 0
        ) {
          // Empty allow array = BlockAll profile (block everything)
          permission = PermissionEnum.BlockAll;
        } else if (
          "block" in config &&
          Array.isArray(config.block) &&
          config.block.length === 0
        ) {
          // Empty block array = AllowAll profile (allow everything)
          permission = PermissionEnum.AllowAll;
        } else {
          // Fallback
          permission = PermissionEnum.Block;
        }

        return {
          id: `profile_${profilesCounter++}`,
          name: groupName,
          permission,
          agents: sortBy(consumers, (agent) => agent.toLowerCase()),
          toolGroups:
            permission === "allow-all" || permission === "block-all"
              ? []
              : sortBy(
                  [
                    ...(config._type === "default-block" &&
                    "allow" in config &&
                    Array.isArray(config.allow)
                      ? config.allow
                      : "block" in config && Array.isArray(config.block)
                        ? config.block
                        : []),
                  ],
                  (group) => group.toLowerCase(),
                ).map(
                  (group) =>
                    toolGroups.find((g) => g.name === group)?.id || group,
                ),
        } as AgentProfile;
      },
    );

    set({
      agentsList,
      appConfigUpdates: null,
      hasPendingChanges: false,
      profiles: [defaultProfile, ...profiles],
      toolGroups,
    });
  },
  resetAppConfigUpdates: () => {
    set({
      appConfigUpdates: null,
      hasPendingChanges: false,
    });
  },
  setAgentsList: (update: string[] | ((profiles: string[]) => string[])) => {
    if (typeof update === "function") {
      set((state) => ({
        agentsList: update(state.agentsList),
      }));
    } else {
      set({ agentsList: update });
    }
    get().setAppConfigUpdates();
  },
  setAppConfigUpdates: () => {
    const currentAppConfig = socketStore.getState().appConfig;
    const currentSystemState = socketStore.getState().systemState;
    if (!currentAppConfig || !currentSystemState) {
      return;
    }

    const { profiles, toolGroups } = get();
    const [defaultProfile] = profiles;
    const defaultProfileToolGroups = sortBy(
      Array.from(
        new Set(
          defaultProfile.toolGroups
            ?.map((group) => toolGroups.find((g) => g.id === group)?.name || "")
            .filter(Boolean),
        ),
      ),
      (group) => group.toLowerCase(),
    );
    if (
      defaultProfile.permission === "allow-all" ||
      defaultProfile.permission === "block-all"
    ) {
      set((prev) => {
        return {
          ...prev,
          profiles: prev.profiles.map((profile) => {
            if (profile.id === defaultProfile.id) {
              return {
                ...profile,
                toolGroups: [],
              };
            }
            return profile;
          }),
        };
      });
    }

    // Always preserve the original default config - it should never change when
    // modifying agent-specific profiles. The default config only changes when
    // explicitly modified the app.yaml file.
    const originalDefaultConfig = currentAppConfig.permissions.default;

    const appConfigUpdates: AppConfig = {
      ...currentAppConfig,
      permissions: {
        ...currentAppConfig.permissions,
        default: originalDefaultConfig,
        consumers: {
          ...Object.fromEntries(
            sortBy(
              [
                ...profiles
                  .filter(
                    (p) =>
                      p.name !== DEFAULT_PROFILE_NAME && p.agents.length > 0,
                  )
                  .flatMap((profile) => {
                    const profileToolGroups = sortBy(
                      Array.from(
                        new Set(
                          profile.toolGroups
                            .map(
                              (group) =>
                                toolGroups.find((g) => g.id === group)?.name ||
                                "",
                            )
                            .filter(Boolean),
                        ),
                      ),
                      (group) => group.toLowerCase(),
                    );
                    return profile.agents
                      .filter((agent) => agent !== "")
                      .map((agent) => {
                        let consumerConfig: ConsumerConfig;

                        if (profile.permission === "allow") {
                          consumerConfig = {
                            _type: "default-block",
                            consumerGroupKey: profile.name,
                            allow: profileToolGroups,
                          };
                        } else if (profile.permission === "block") {
                          consumerConfig = {
                            _type: "default-allow",
                            consumerGroupKey: profile.name,
                            block: profileToolGroups,
                          };
                        } else if (profile.permission === "allow-all") {
                          consumerConfig = {
                            _type: "default-allow",
                            consumerGroupKey: profile.name,
                            block: [], // Empty block array = allow all tools
                          };
                        } else if (profile.permission === "block-all") {
                          consumerConfig = {
                            _type: "default-block",
                            consumerGroupKey: profile.name,
                            allow: [], // Empty allow array = block all tools
                          };
                        } else {
                          // Fallback to block permission
                          consumerConfig = {
                            _type: "default-allow",
                            consumerGroupKey: profile.name,
                            block: profileToolGroups,
                          };
                        }

                        return [agent, consumerConfig];
                      });
                  }),
              ].filter(([key]) => Boolean(key)),
              ([key]) => key,
            ),
          ),
        },
      },
      toolGroups: toolGroups.map((group) => ({
        name: group.name,
        description: group.description,
        services: Object.fromEntries(
          Object.entries(group.services)
            .map(([serviceName, tools]) => [
              serviceName,
              Array.isArray(tools)
                ? currentSystemState.targetServers_new.find(
                    (server) => server.name === serviceName,
                  )?.tools.length === tools.length
                  ? "*"
                  : tools
                : undefined,
            ])
            .filter(([, tools]) => tools !== undefined),
        ),
      })),
    };

    set({
      appConfigUpdates,
      hasPendingChanges: diff(currentAppConfig, appConfigUpdates).length > 0,
    });
  },
  setProfiles: (
    update: AgentProfile[] | ((profiles: AgentProfile[]) => AgentProfile[]),
    skipConfigUpdate?: boolean,
  ) => {
    if (typeof update === "function") {
      set((state) => {
        const profiles = update(state.profiles);
        return {
          profiles,
        };
      });
    } else {
      set({ profiles: update });
    }
    // Only update config if not explicitly skipped (for Agent Details modal changes)
    if (!skipConfigUpdate) {
      get().setAppConfigUpdates();
    }
  },
  setToolGroups: (
    update: ToolGroup[] | ((prev: ToolGroup[]) => ToolGroup[]),
  ) => {
    if (typeof update === "function") {
      set((state) => {
        const groups = update(state.toolGroups);
        return {
          toolGroups: groups,
        };
      });
    } else {
      set({ toolGroups: update });
    }
    get().setAppConfigUpdates();
  },
}));

// Subscribe to socket store updates to keep access controls state
// in sync with the app configuration and system state.
socketStore.subscribe((state) => {
  if (accessControlsStore.getState().hasPendingChanges) {
    // If there are pending changes, do not update the access-controls
    // store with the new socket state, as it may overwrite those changes.
    return;
  }
  accessControlsStore.getState().init(state);
});

export const useAccessControlsStore = <T>(
  selector: (state: AccessControlsStore) => T,
) => accessControlsStore(useShallow(selector));

export { accessControlsStore };

export const initAccessControlsStore = () => {
  accessControlsStore.getState().resetAppConfigUpdates();
  accessControlsStore.getState().init(socketStore.getState());
};
