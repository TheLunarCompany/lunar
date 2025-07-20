import { AppConfig } from "@mcpx/shared-model";
import { diff } from "json-diff-ts";
import sortBy from "lodash/sortBy";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { SocketStore, socketStore } from "./socket";

export type Permission = "allow" | "block";
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
      socketStoreState.systemState?.targetServers?.map((server) => ({
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

    const defaultProfile = {
      id: `profile_${profilesCounter++}`,
      name: DEFAULT_PROFILE_NAME,
      permission: socketStoreState.appConfig?.permissions.base,
      agents: agentsList,
      toolGroups: sortBy(
        socketStoreState.appConfig?.permissions.base === "block"
          ? socketStoreState.appConfig?.permissions.consumers[
              DEFAULT_PROFILE_NAME
            ]?.profiles?.allow || []
          : socketStoreState.appConfig?.permissions.consumers[
              DEFAULT_PROFILE_NAME
            ]?.profiles?.block || [],
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
                    ...(config.profiles?.allow || []),
                    ...(config.profiles?.block || []),
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
                config.base === "allow" || config.profiles?.block?.length
                  ? ("allow" as const)
                  : ("block" as const),
              agents: [name],
              toolGroups: sortBy(
                [
                  ...(config.profiles?.allow || []),
                  ...(config.profiles?.block || []),
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

    // If tool groups are set for the default profile, then we need to
    // include the default profile as a consumer.
    const includeDefaultProfileConsumers =
      defaultProfile.toolGroups.length > 0 &&
      profiles.some((p) => p.name === DEFAULT_PROFILE_NAME);

    const getConsumerProfiles = (
      profilePermission: Permission,
      profileToolGroups: string[],
    ):
      | {
          allow: string[];
        }
      | {
          block: string[];
        } => {
      return profilePermission === "block"
        ? { allow: profileToolGroups }
        : { block: profileToolGroups };
    };

    const appConfigUpdates: AppConfig = {
      ...currentAppConfig,
      permissions: {
        ...currentAppConfig.permissions,
        base: defaultProfile?.permission || "block",
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
                      .map((agent) => [
                        agent,
                        {
                          base: profile.permission,
                          consumerGroupKey: profile.name,
                          profiles: getConsumerProfiles(
                            profile.permission,
                            profileToolGroups,
                          ),
                        },
                      ]);
                  }),
                includeDefaultProfileConsumers
                  ? [
                      DEFAULT_PROFILE_NAME,
                      {
                        base: defaultProfile.permission,
                        consumerGroupKey: defaultProfile.name,
                        profiles: getConsumerProfiles(
                          defaultProfile.permission,
                          defaultProfileToolGroups,
                        ),
                      },
                    ]
                  : [],
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
  accessControlsStore.getState().init(state);
});

export const useAccessControlsStore = <T>(
  selector: (state: AccessControlsStore) => T,
) => accessControlsStore(useShallow(selector));

export const initAccessControlsStore = () => {
  accessControlsStore.getState().resetAppConfigUpdates();
  accessControlsStore.getState().init(socketStore.getState());
};
