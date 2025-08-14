import {
  NextVersionAppConfigCompat as AppConfig,
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
  ) => void) &
    ((profiles: AgentProfile[]) => void);
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

    const agentsList = sortBy(
      [
        ...new Set(
          (
            socketStoreState.systemState?.connectedClients.map(
              ({ consumerTag }, index) => consumerTag || `Agent ${index + 1}`,
            ) || []
          ).concat(
            Object.keys(
              socketStoreState.appConfig?.permissions.consumers,
            ).filter(
              // Skip the default profile as it can't be selected
              (name) => name !== DEFAULT_PROFILE_NAME,
            ),
          ),
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
      ({ name, services }, index) => ({
        id: `tool_group_${index}`,
        name,
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
        ? socketStoreState.appConfig?.permissions.default.block.length
          ? PermissionEnum.Block
          : PermissionEnum.AllowAll
        : socketStoreState.appConfig?.permissions.default.allow.length
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
          ? socketStoreState.appConfig?.permissions.default.block || []
          : socketStoreState.appConfig?.permissions.default.allow || [],
        (group) => group.toLowerCase(),
      )
        .map((group) => toolGroups.find((g) => g.name === group)?.id || "")
        .filter(Boolean),
    };

    const profiles = socketStoreState.appConfig?.permissions.consumers
      ? Object.entries(socketStoreState.appConfig.permissions.consumers).reduce(
          (acc, [name, config]) => {
            if (
              !config.consumerGroupKey ||
              config.consumerGroupKey === DEFAULT_PROFILE_NAME ||
              name === DEFAULT_PROFILE_NAME
            ) {
              // Skip the default profile as it's already handled separately
              return acc;
            }
            const existingProfile = acc.find(
              (profile) => profile.name === config.consumerGroupKey,
            );
            if (existingProfile) {
              // If the profile already exists, merge tool groups
              existingProfile.toolGroups = sortBy(
                [
                  ...new Set([
                    ...existingProfile.toolGroups,
                    ...(config._type === "default-block"
                      ? config.allow
                      : config.block),
                  ]),
                ],
                (group) => group.toLowerCase(),
              ).map(
                (group) =>
                  toolGroups.find((g) => g.name === group)?.id || group,
              );
              existingProfile.agents = sortBy(
                [...new Set([...existingProfile.agents, name])],
                (agent) => agent.toLowerCase(),
              );
              return acc;
            }

            const profile = {
              id: `profile_${profilesCounter++}`,
              name: config.consumerGroupKey,
              permission:
                config._type === "default-allow"
                  ? config.block.length
                    ? PermissionEnum.Allow
                    : PermissionEnum.AllowAll
                  : config.allow.length
                    ? PermissionEnum.Block
                    : PermissionEnum.BlockAll,
              agents: [name],
              toolGroups: sortBy(
                [
                  ...(config._type === "default-block"
                    ? config.allow
                    : config.block),
                ],
                (group) => group.toLowerCase(),
              ).map(
                (group) =>
                  toolGroups.find((g) => g.name === group)?.id || group,
              ),
            };
            acc.push(profile);
            return acc;
          },
          [] as AgentProfile[],
        )
      : [];

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
    const appConfigUpdates: AppConfig = {
      ...currentAppConfig,
      permissions: {
        ...currentAppConfig.permissions,
        default: (defaultProfile.permission === "allow" && {
          _type: "default-block",
          allow: defaultProfileToolGroups,
        }) ||
          (defaultProfile.permission === "allow-all" && {
            _type: "default-allow",
            block: [],
          }) ||
          (defaultProfile.permission === "block-all" && {
            _type: "default-block",
            allow: [],
          }) || {
            _type: "default-allow",
            block: defaultProfileToolGroups,
          },
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
                        const consumerConfig: ConsumerConfig =
                          profile.permission === "block"
                            ? {
                                _type: "default-allow",
                                consumerGroupKey: profile.name,
                                block: profileToolGroups,
                              }
                            : {
                                _type: "default-block",
                                consumerGroupKey: profile.name,
                                allow: profileToolGroups,
                              };
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
    get().setAppConfigUpdates();
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

export const initAccessControlsStore = () => {
  accessControlsStore.getState().resetAppConfigUpdates();
  accessControlsStore.getState().init(socketStore.getState());
};
