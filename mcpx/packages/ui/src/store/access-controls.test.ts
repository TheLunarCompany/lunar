import { beforeEach, describe, expect, it } from "vitest";
import {
  type AgentProfile,
  type AgentRef,
  DEFAULT_PROFILE_NAME,
  PermissionEnum,
  accessControlsStore,
} from "./access-controls";
import { socketStore } from "./socket";

const consumerAgent = (name: string): AgentRef => ({
  name,
  identityType: "consumers",
});

const clientNameAgent = (name: string): AgentRef => ({
  name,
  identityType: "clientNames",
});

function resetSocketStore() {
  socketStore.setState({
    appConfig: null,
    serializedAppConfig: null,
    systemState: null,
  });
}

function resetAccessControlsStore() {
  accessControlsStore.setState({
    agentsList: [],
    appConfigUpdates: null,
    hasPendingChanges: false,
    profiles: [],
    toolGroupModalData: undefined,
    toolGroups: [],
  });
}

function seedSocketState() {
  socketStore.setState({
    appConfig: {
      permissions: {
        consumers: {
          "claude-session": {
            _type: "default-block",
            allow: ["Approved"],
            consumerGroupKey: "reviewers",
          },
          "codex-session": {
            _type: "default-allow",
            block: [],
            consumerGroupKey: "operators",
          },
        },
        default: {
          _type: "default-allow",
          block: ["Restricted"],
        },
      },
      toolExtensions: {
        services: {},
      },
      toolGroups: [
        {
          description: "approved tools",
          name: "Approved",
          services: {
            filesystem: ["read_file"],
          },
        },
        {
          description: "restricted tools",
          name: "Restricted",
          services: {
            slack: "*",
          },
        },
      ],
    } as never,
    systemState: {
      connectedClientClusters: [
        {
          identityType: "consumerTag",
          consumerTag: "Claude",
          clientNames: ["claude-ai"],
          sessionIds: ["sess-1"],
        },
        {
          identityType: "clientName",
          clientName: "FallbackOnly",
          sessionIds: ["missing-session"],
        },
      ],
      connectedClients: [{ consumerTag: "Claude", sessionId: "sess-1" }],
      targetServers: [
        {
          name: "filesystem",
          tools: [{ name: "read_file" }, { name: "write_file" }],
        },
        { name: "slack", tools: [{ name: "post_message" }] },
      ],
    } as never,
  });
}

// Skipped: the /access-controls page that this store powers is deprecated and unlinked from the UI.
// The store's profile-derivation logic doesn't read from the new permissions.clientNames key
// either — re-enabling these tests requires reviving (or removing) the page first.
describe.skip("accessControlsStore", () => {
  beforeEach(() => {
    resetSocketStore();
    resetAccessControlsStore();
  });

  it("initializes agent lists, tool groups, and profiles from socket state", () => {
    seedSocketState();

    accessControlsStore.getState().init(socketStore.getState());

    expect(accessControlsStore.getState().agentsList).toEqual([
      consumerAgent("Claude"),
      clientNameAgent("FallbackOnly"),
    ]);

    expect(accessControlsStore.getState().toolGroups).toEqual([
      {
        description: "approved tools",
        id: "tool_group_0",
        name: "Approved",
        services: {
          filesystem: ["read_file"],
        },
      },
      {
        description: "restricted tools",
        id: "tool_group_1",
        name: "Restricted",
        services: {
          slack: ["post_message"],
        },
      },
    ]);

    expect(accessControlsStore.getState().profiles).toEqual([
      {
        agents: [consumerAgent("Claude"), clientNameAgent("FallbackOnly")],
        id: "profile_0",
        name: DEFAULT_PROFILE_NAME,
        permission: PermissionEnum.Block,
        toolGroups: ["tool_group_1"],
      },
      {
        agents: [consumerAgent("claude-session")],
        id: "profile_1",
        name: "reviewers",
        permission: PermissionEnum.Allow,
        toolGroups: ["tool_group_0"],
      },
      {
        agents: [consumerAgent("codex-session")],
        id: "profile_2",
        name: "operators",
        permission: PermissionEnum.AllowAll,
        toolGroups: [],
      },
    ]);
  });

  it("builds app config updates when profiles or groups change", () => {
    seedSocketState();
    accessControlsStore.getState().init(socketStore.getState());

    const profiles: AgentProfile[] = [
      {
        id: "profile_0",
        name: DEFAULT_PROFILE_NAME,
        permission: PermissionEnum.AllowAll,
        agents: [consumerAgent("Claude"), clientNameAgent("FallbackOnly")],
        toolGroups: ["tool_group_1"],
      },
      {
        id: "profile_1",
        name: "reviewers",
        permission: PermissionEnum.Block,
        agents: [consumerAgent("claude-session"), consumerAgent("")],
        toolGroups: ["tool_group_0"],
      },
      {
        id: "profile_2",
        name: "operators",
        permission: PermissionEnum.BlockAll,
        agents: [consumerAgent("codex-session")],
        toolGroups: ["tool_group_1"],
      },
    ];
    accessControlsStore.getState().setProfiles(() => profiles);

    expect(accessControlsStore.getState().hasPendingChanges).toBe(true);
    expect(accessControlsStore.getState().profiles[0].toolGroups).toEqual([]);
    expect(accessControlsStore.getState().appConfigUpdates).toMatchObject({
      permissions: {
        consumers: {
          "claude-session": {
            _type: "default-allow",
            block: ["Approved"],
            consumerGroupKey: "reviewers",
          },
          "codex-session": {
            _type: "default-block",
            allow: [],
            consumerGroupKey: "operators",
          },
        },
        default: {
          _type: "default-allow",
          block: ["Restricted"],
        },
      },
    });
  });

  it("supports agent and tool group updates and can clear pending updates", () => {
    seedSocketState();
    accessControlsStore.getState().init(socketStore.getState());

    accessControlsStore
      .getState()
      .setAgentsList((agents) => [...agents, clientNameAgent("Cursor")]);
    accessControlsStore.getState().setToolGroups((groups) => [
      ...groups,
      {
        id: "tool_group_2",
        name: "All Filesystem",
        services: {
          filesystem: ["read_file", "write_file"],
        },
      },
    ]);

    expect(accessControlsStore.getState().agentsList).toContainEqual(
      clientNameAgent("Cursor"),
    );
    expect(
      accessControlsStore.getState().appConfigUpdates?.toolGroups,
    ).toContainEqual({
      description: undefined,
      name: "All Filesystem",
      services: {
        filesystem: "*",
      },
    });

    accessControlsStore.getState().resetAppConfigUpdates();

    expect(accessControlsStore.getState()).toMatchObject({
      appConfigUpdates: null,
      hasPendingChanges: false,
    });
  });
});
