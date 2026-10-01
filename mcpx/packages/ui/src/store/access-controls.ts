import { AppConfig, ConsumerConfig } from "@mcpx/shared-model";
import { diff } from "json-diff-ts";
import sortBy from "lodash/sortBy";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { SocketStore, socketStore } from "./socket";
import { createDevtoolsOptions } from "./devtools";
export const PermissionEnum = {
  Allow: "allow",
  Block: "block",
  AllowAll: "allow-all",
  BlockAll: "block-all",
} as const;

export type Permission = (typeof PermissionEnum)[keyof typeof PermissionEnum];
export type AgentRef = {
  name: string;
  identityType: "consumers" | "clientNames";
};

export type AgentProfile = {
  id: string;
  name: string;
  permission: Permission;
  agents: AgentRef[];
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
  agentsList: AgentRef[];
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
    update: AgentRef[] | ((profiles: AgentRef[]) => AgentRef[]),
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

const buildConsumerConfigFromAgentProfile = (
  profile: AgentProfile,
  profileToolGroups: string[],
): ConsumerConfig => {
  switch (profile.permission) {
    case "allow":
      return {
        _type: "default-block",
        consumerGroupKey: profile.name,
        allow: profileToolGroups,
      };
    case "block":
      return {
        _type: "default-allow",
        consumerGroupKey: profile.name,
        block: profileToolGroups,
      };
    case "allow-all":
      return {
        _type: "default-allow",
        consumerGroupKey: profile.name,
        block: [],
      };
    case "block-all":
      return {
        _type: "default-block",
        consumerGroupKey: profile.name,
        allow: [],
      };
  }
};

const getPermissionTypeFromPermissions = (
  permission: ConsumerConfig,
): Permission => {
  return permission._type === "default-allow"
    ? permission.block.length > 0
      ? PermissionEnum.Block
      : PermissionEnum.AllowAll
    : permission.allow.length > 0
      ? PermissionEnum.Allow
      : PermissionEnum.BlockAll;
};

/**
 * Builds the permissions map for one identity scope ("consumers" or "clientNames")
 * from the current profiles state.
 *
 * For each non-default profile, resolves tool group IDs to names, builds the
 * ConsumerConfig from the profile's permission setting, and emits one
 * [agentName, config] entry per agent of the given identityType.
 * Agents of the other scope are skipped — each scope is built independently.
 *
 * The result is a record ready to be written directly into
 * appConfig.permissions.consumers / appConfig.permissions.clientNames.
 */

const buildConsumerConfigEntries = (
  profiles: AgentProfile[],
  identityType: AgentRef["identityType"],
  toolGroups: ToolGroup[],
): Record<string, ConsumerConfig> =>
  Object.fromEntries(
    sortBy(
      profiles
        .filter((p) => p.name !== DEFAULT_PROFILE_NAME && p.agents.length > 0)
        .flatMap((profile) => {
          const profileToolGroups = sortBy(
            Array.from(
              new Set(
                profile.toolGroups.flatMap((id) => {
                  const name = toolGroups.find((g) => g.id === id)?.name;
                  return name ? [name] : [];
                }),
              ),
            ),
            (g) => g.toLowerCase(),
          );
          const config = buildConsumerConfigFromAgentProfile(
            profile,
            profileToolGroups,
          );
          return profile.agents
            .filter((a) => a.identityType === identityType && a.name !== "")
            .map((a): [string, ConsumerConfig] => [a.name, config]);
        }),
      ([key]) => key,
    ),
  );

const populateAgentsGroups = (
  agentsGroups: Map<string, { agents: AgentRef[]; config: ConsumerConfig }>,
  entries: Record<string, ConsumerConfig>,
  identityType: AgentRef["identityType"],
): void => {
  Object.entries(entries).forEach(([name, config]) => {
    if (
      !config.consumerGroupKey ||
      config.consumerGroupKey === DEFAULT_PROFILE_NAME
    )
      return;
    const existing = agentsGroups.get(config.consumerGroupKey);
    if (existing) {
      existing.agents.push({ name, identityType });
    } else {
      agentsGroups.set(config.consumerGroupKey, {
        agents: [{ name, identityType }],
        config,
      });
    }
  });
};

const accessControlsStore = create<AccessControlsStore>()(
  devtools(
    (set, get) => ({
      ...initialState,
      init: (socketStoreState: SocketStore) => {
        if (!socketStoreState.systemState || !socketStoreState.appConfig) {
          return;
        }

        // Get agent list from connected clients, using consumerTag if available, otherwise fall back to cluster name
        const agentsList = sortBy(
          (socketStoreState.systemState?.connectedClientClusters ?? []).flatMap(
            (cluster): AgentRef[] => {
              switch (cluster.identityType) {
                case "consumerTag":
                  return [
                    { name: cluster.consumerTag, identityType: "consumers" },
                  ];
                case "clientName":
                  return [
                    { name: cluster.clientName, identityType: "clientNames" },
                  ];
                case "anonymous":
                  return [];
              }
            },
          ),
          (agent) => agent.name.toLowerCase(),
        );

        const mcpServers =
          socketStoreState.systemState?.targetServers?.map((server) => ({
            name: server.name,
            tools: server.tools.map((tool) => tool.name),
          })) || [];

        const toolGroups = socketStoreState.appConfig?.toolGroups.map(
          (toolGroup, index) => ({
            id: `tool_group_${index}`,
            name: toolGroup.name,
            description: toolGroup.description || "",
            services: Object.fromEntries(
              sortBy(
                Object.entries(toolGroup.services).map(
                  ([serviceName, tools]) => [
                    serviceName,
                    tools === "*"
                      ? mcpServers.find((server) => server.name === serviceName)
                          ?.tools || []
                      : tools,
                  ],
                ),
                ([key]) => key.toLowerCase(),
              ),
            ),
          }),
        );

        let profilesCounter = 0;
        const defaultProfilePermission = getPermissionTypeFromPermissions(
          socketStoreState.appConfig?.permissions.default,
        );

        const defaultProfile: AgentProfile = {
          id: `profile_${profilesCounter++}`,
          name: DEFAULT_PROFILE_NAME,
          permission: defaultProfilePermission,
          agents: agentsList,
          toolGroups: sortBy(
            socketStoreState.appConfig?.permissions.default._type ===
              "default-allow"
              ? socketStoreState.appConfig.permissions.default.block
              : socketStoreState.appConfig.permissions.default.allow,
            (group) => group.toLowerCase(),
          ).flatMap((group) => {
            const id = toolGroups.find((g) => g.name === group)?.id;
            return id ? [id] : [];
          }),
        };

        // Group consumers by their consumerGroupKey to create profiles

        const agentsGroups = new Map<
          string,
          { agents: AgentRef[]; config: ConsumerConfig }
        >();
        populateAgentsGroups(
          agentsGroups,
          socketStoreState.appConfig.permissions.consumers,
          "consumers",
        );
        populateAgentsGroups(
          agentsGroups,
          socketStoreState.appConfig.permissions.clientNames,
          "clientNames",
        );

        const profiles = Array.from(agentsGroups.entries()).map(
          ([groupName, { agents, config }]) => {
            // Determine permission based on array contents only
            const permission = getPermissionTypeFromPermissions(config);
            return {
              id: `profile_${profilesCounter++}`,
              name: groupName,
              permission,
              agents: sortBy(agents, (agent) => agent.name.toLowerCase()),
              toolGroups:
                permission === "allow-all" || permission === "block-all"
                  ? []
                  : sortBy(
                      [
                        ...(config._type === "default-block"
                          ? config.allow
                          : config.block),
                      ],
                      (group) => group.toLowerCase(),
                    )
                      .map(
                        (group) => toolGroups.find((g) => g.name === group)?.id,
                      )
                      .filter((id): id is string => id != null),
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
      setAgentsList: (
        update: AgentRef[] | ((agents: AgentRef[]) => AgentRef[]),
      ) => {
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
            consumers: buildConsumerConfigEntries(
              profiles,
              "consumers",
              toolGroups,
            ),
            clientNames: buildConsumerConfigEntries(
              profiles,
              "clientNames",
              toolGroups,
            ),
          },
          toolGroups: toolGroups.map((group) => ({
            name: group.name,
            description: group.description,
            services: Object.fromEntries(
              Object.entries(group.services)
                .map(([serviceName, tools]) => [
                  serviceName,
                  Array.isArray(tools)
                    ? currentSystemState.targetServers.find(
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
          hasPendingChanges:
            diff(currentAppConfig, appConfigUpdates).length > 0,
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
    }),
    createDevtoolsOptions("access-controls"),
  ),
);

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
