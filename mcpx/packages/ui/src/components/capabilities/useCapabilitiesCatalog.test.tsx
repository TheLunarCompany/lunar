import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { socketStore } from "@/store/socket";
import {
  createCapabilityGroup,
  updateCapabilityGroup,
} from "./capability-actions";
import { useCapabilitiesCatalog } from "./useCapabilitiesCatalog";

const toastMock = vi.hoisted(() => vi.fn());
const dismissMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: toastMock,
    dismiss: dismissMock,
  }),
}));

vi.mock("./capability-actions", () => ({
  createCapabilityGroup: vi.fn(),
  updateCapabilityGroup: vi.fn(),
  deleteCapabilityGroup: vi.fn(),
  createCustomCapabilityTool: vi.fn(),
  updateCustomCapabilityTool: vi.fn(),
  deleteCustomCapabilityTool: vi.fn(),
}));

const mockedCreateCapabilityGroup = vi.mocked(createCapabilityGroup);
const mockedUpdateCapabilityGroup = vi.mocked(updateCapabilityGroup);

function seedSocketData() {
  socketStore.setState({
    appConfig: {
      permissions: {
        default: { _type: "default-allow", block: [] },
        consumers: {},
        clientNames: {},
      },
      toolExtensions: {
        services: {
          filesystem: {
            read_file: {
              childTools: [
                {
                  name: "safe_read",
                  description: { action: "rewrite", text: "Safe read" },
                  overrideParams: {},
                },
              ],
            },
          },
        },
      },
      toolGroups: [
        {
          name: "Readers",
          description: "Read access",
          services: {
            filesystem: ["read_file"],
            github: ["list_repos"],
          },
        },
        {
          name: "Legacy",
          description: "Saved unavailable tools",
          services: {
            filesystem: ["read_file", "retired_tool"],
            offline: ["archived_tool"],
          },
        },
      ],
    } as never,
    systemState: {
      connectedClientClusters: [],
      connectedClients: [],
      targetServers: [
        {
          name: "filesystem",
          state: { type: "connected" },
          icon: "folder",
          originalTools: [
            {
              name: "read_file",
              description: "Read a file",
              inputSchema: { type: "object" },
              annotations: { readOnlyHint: true },
            },
            {
              name: "write_file",
              description: "Write a file",
              inputSchema: { type: "object" },
              annotations: {},
            },
            {
              name: "delete_file",
              description: "Delete a file",
              inputSchema: { type: "object" },
              annotations: { destructiveHint: true },
            },
          ],
          tools: [
            {
              name: "read_file",
              description: "Read a file",
              inputSchema: { type: "object" },
              annotations: { readOnlyHint: true },
              usage: { callCount: 0 },
            },
            {
              name: "safe_read",
              description: "Materialized safe read",
              inputSchema: { type: "object" },
              annotations: { readOnlyHint: true },
              usage: { callCount: 0 },
            },
            {
              name: "write_file",
              description: "Write a file",
              inputSchema: { type: "object" },
              annotations: {},
              usage: { callCount: 0 },
            },
            {
              name: "delete_file",
              description: "Delete a file",
              inputSchema: { type: "object" },
              annotations: { destructiveHint: true },
              usage: { callCount: 0 },
            },
          ],
        },
        {
          name: "github",
          state: { type: "connected" },
          icon: "github",
          originalTools: [
            {
              name: "list_repos",
              description: "List repositories",
              inputSchema: { type: "object" },
              annotations: { readOnlyHint: true },
            },
          ],
          tools: [
            {
              name: "list_repos",
              description: "List repositories",
              inputSchema: { type: "object" },
              annotations: { readOnlyHint: true },
              usage: { callCount: 0 },
            },
          ],
        },
      ],
    } as never,
  });
}

function visibleItemNames(result: {
  current: ReturnType<typeof useCapabilitiesCatalog>;
}) {
  return result.current.visibleProviders.flatMap((provider) =>
    provider.items.map((item) => `${provider.name}:${item.name}`),
  );
}

function appendToolGroups(
  toolGroups: NonNullable<
    NonNullable<
      ReturnType<typeof socketStore.getState>["appConfig"]
    >["toolGroups"]
  >,
) {
  const appConfig = socketStore.getState().appConfig;

  socketStore.setState({
    appConfig: {
      ...appConfig,
      toolGroups: [...(appConfig?.toolGroups ?? []), ...toolGroups],
    } as never,
  });
}

describe("useCapabilitiesCatalog", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    socketStore.setState({ appConfig: null, systemState: null });
  });

  afterEach(() => {
    socketStore.setState({ appConfig: null, systemState: null });
  });

  it("returns empty providers and groups when current backend data is missing", () => {
    const { result } = renderHook(() => useCapabilitiesCatalog());

    expect(result.current.providers).toEqual([]);
    expect(result.current.groups).toEqual([]);
    expect(result.current.visibleProviders).toEqual([]);
  });

  it("reads current socket/app config data and exposes adapted providers and groups", () => {
    seedSocketData();

    const { result } = renderHook(() => useCapabilitiesCatalog());

    expect(result.current.providers.map((provider) => provider.name)).toEqual([
      "filesystem",
      "github",
    ]);
    expect(result.current.providers[0]?.items.map((item) => item.name)).toEqual(
      ["safe_read", "delete_file", "read_file", "write_file"],
    );
    expect(result.current.groups.map((group) => group.name)).toEqual([
      "Readers",
      "Legacy",
    ]);
  });

  it("filters visible items by search text and annotation options", () => {
    seedSocketData();
    const { result } = renderHook(() => useCapabilitiesCatalog());

    act(() => result.current.setSearchQuery("read"));
    expect(visibleItemNames(result)).toEqual([
      "filesystem:safe_read",
      "filesystem:read_file",
    ]);

    act(() => {
      result.current.setSearchQuery("");
      result.current.setAnnotationFilter(["read-only"]);
    });
    expect(visibleItemNames(result)).toEqual([
      "filesystem:safe_read",
      "filesystem:read_file",
      "github:list_repos",
    ]);

    act(() => result.current.setAnnotationFilter(["write"]));
    expect(visibleItemNames(result)).toEqual(["filesystem:write_file"]);

    act(() => result.current.setAnnotationFilter(["destructive"]));
    expect(visibleItemNames(result)).toEqual(["filesystem:delete_file"]);
  });

  it("toggles provider expansion and limits visible items to the selected group", () => {
    seedSocketData();
    const { result } = renderHook(() => useCapabilitiesCatalog());

    act(() => result.current.toggleProviderExpansion("filesystem"));
    expect(result.current.expandedProviders.has("filesystem")).toBe(true);

    act(() => result.current.clearProviderExpansion());
    expect(result.current.expandedProviders.size).toBe(0);

    act(() => result.current.toggleProviderExpansion("filesystem"));
    expect(result.current.expandedProviders.has("filesystem")).toBe(true);

    act(() => result.current.toggleProviderExpansion("filesystem"));
    expect(result.current.expandedProviders.has("filesystem")).toBe(false);

    act(() => result.current.selectGroup("Readers"));
    expect(result.current.selectedGroup?.name).toBe("Readers");
    expect(visibleItemNames(result)).toEqual([
      "filesystem:read_file",
      "github:list_repos",
    ]);
  });

  it("rejects invalid create/update group names before action wrappers are called", async () => {
    seedSocketData();
    const { result } = renderHook(() => useCapabilitiesCatalog());

    act(() => result.current.toggleCapabilitySelection("filesystem:read_file"));
    await act(async () => {
      await result.current.createGroup({ name: "   ", description: "" });
    });

    expect(mockedCreateCapabilityGroup).not.toHaveBeenCalled();
    expect(result.current.createGroupError).toBe("Group name cannot be empty");

    await act(async () => {
      await result.current.createGroup({ name: "readers", description: "" });
    });

    expect(mockedCreateCapabilityGroup).not.toHaveBeenCalled();
    expect(result.current.createGroupError).toBe(
      'A capability group named "readers" already exists.',
    );

    act(() => result.current.startEditingGroup("Readers"));
    await act(async () => {
      await result.current.updateEditingGroup({
        name: "Legacy",
        description: "",
      });
    });

    expect(mockedUpdateCapabilityGroup).not.toHaveBeenCalled();
    expect(result.current.editGroupError).toBe(
      'A capability group named "Legacy" already exists.',
    );
  });

  it("shows a destructive toast when a backend action fails", async () => {
    seedSocketData();
    mockedCreateCapabilityGroup.mockRejectedValue(new Error("backend down"));
    const { result } = renderHook(() => useCapabilitiesCatalog());

    act(() => result.current.toggleCapabilitySelection("filesystem:read_file"));
    await act(async () => {
      await result.current.createGroup({
        name: "Operators",
        description: "Operator access",
      });
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Failed to create capability group",
        description: "backend down",
        variant: "destructive",
      }),
    );
  });

  it("creates and edits groups from capability selection keys while preserving hidden saved entries", async () => {
    seedSocketData();
    mockedCreateCapabilityGroup.mockResolvedValue({
      name: "Operators",
      description: "Operator access",
      services: { filesystem: ["write_file"] },
    });
    mockedUpdateCapabilityGroup.mockResolvedValue({
      name: "Legacy",
      description: "Saved unavailable tools",
      services: {
        filesystem: ["read_file", "retired_tool", "write_file"],
        offline: ["archived_tool"],
      },
    });
    const { result } = renderHook(() => useCapabilitiesCatalog());

    act(() => result.current.startCreatingGroup());
    act(() =>
      result.current.toggleCapabilitySelection("filesystem:write_file"),
    );
    await act(async () => {
      await result.current.createGroup({
        name: "Operators",
        description: "Operator access",
      });
    });

    expect(mockedCreateCapabilityGroup).toHaveBeenCalledWith({
      name: "Operators",
      description: "Operator access",
      services: { filesystem: ["write_file"] },
    });

    act(() => result.current.startEditingGroup("Legacy"));
    expect(Array.from(result.current.selectedCapabilityKeys).sort()).toEqual([
      "filesystem:read_file",
      "filesystem:retired_tool",
      "offline:archived_tool",
    ]);

    act(() =>
      result.current.toggleCapabilitySelection("filesystem:write_file"),
    );
    await act(async () => {
      await result.current.updateEditingGroup({
        name: "Legacy",
        description: "Saved unavailable tools",
      });
    });

    expect(mockedUpdateCapabilityGroup).toHaveBeenCalledWith("Legacy", {
      description: "Saved unavailable tools",
      services: {
        filesystem: ["read_file", "retired_tool", "write_file"],
        offline: ["archived_tool"],
      },
    });
  });

  it("preserves an unchanged visible wildcard provider when updating a group", async () => {
    seedSocketData();
    appendToolGroups([
      {
        name: "All GitHub",
        description: "Every GitHub capability",
        services: {
          github: "*",
        },
      },
    ]);
    mockedUpdateCapabilityGroup.mockResolvedValue({
      name: "All GitHub",
      description: "Every GitHub capability",
      services: {
        github: "*",
      },
    });
    const { result } = renderHook(() => useCapabilitiesCatalog());

    act(() => result.current.startEditingGroup("All GitHub"));
    await act(async () => {
      await result.current.updateEditingGroup({
        name: "All GitHub",
        description: "Every GitHub capability",
      });
    });

    expect(mockedUpdateCapabilityGroup).toHaveBeenCalledWith("All GitHub", {
      description: "Every GitHub capability",
      services: {
        github: "*",
      },
    });
  });

  it("preserves an unchanged unavailable wildcard provider when updating a group", async () => {
    seedSocketData();
    appendToolGroups([
      {
        name: "Unavailable Wildcard",
        description: "Provider is not currently connected",
        services: {
          offline: "*",
        },
      },
    ]);
    mockedUpdateCapabilityGroup.mockResolvedValue({
      name: "Unavailable Wildcard",
      description: "Provider is not currently connected",
      services: {
        offline: "*",
      },
    });
    const { result } = renderHook(() => useCapabilitiesCatalog());

    act(() => result.current.startEditingGroup("Unavailable Wildcard"));
    await act(async () => {
      await result.current.updateEditingGroup({
        name: "Unavailable Wildcard",
        description: "Provider is not currently connected",
      });
    });

    expect(mockedUpdateCapabilityGroup).toHaveBeenCalledWith(
      "Unavailable Wildcard",
      {
        description: "Provider is not currently connected",
        services: {
          offline: "*",
        },
      },
    );
  });

  it("round trips selection keys for provider and tool names containing colons", async () => {
    socketStore.setState({
      appConfig: {
        permissions: {
          default: { _type: "default-allow", block: [] },
          consumers: {},
          clientNames: {},
        },
        toolExtensions: { services: {} },
        toolGroups: [],
      } as never,
      systemState: {
        connectedClientClusters: [],
        connectedClients: [],
        targetServers: [
          {
            name: "github:prod",
            state: { type: "connected" },
            icon: "github",
            originalTools: [
              {
                name: "run:tool",
                description: "Run tool",
                inputSchema: { type: "object" },
                annotations: {},
              },
            ],
            tools: [
              {
                name: "run:tool",
                description: "Run tool",
                inputSchema: { type: "object" },
                annotations: {},
                usage: { callCount: 0 },
              },
            ],
          },
        ],
      } as never,
    });
    mockedCreateCapabilityGroup.mockResolvedValue({
      name: "Colon Group",
      description: "Colon names",
      services: { "github:prod": ["run:tool"] },
    });
    const { result } = renderHook(() => useCapabilitiesCatalog());

    act(() =>
      result.current.toggleCapabilitySelection("github%3Aprod:run%3Atool"),
    );
    await act(async () => {
      await result.current.createGroup({
        name: "Colon Group",
        description: "Colon names",
      });
    });

    expect(mockedCreateCapabilityGroup).toHaveBeenCalledWith({
      name: "Colon Group",
      description: "Colon names",
      services: { "github:prod": ["run:tool"] },
    });
  });

  it("does not import the Tools catalog hook or Tools feature files", () => {
    const source = readFileSync(
      "src/components/capabilities/useCapabilitiesCatalog.tsx",
      "utf8",
    );

    expect(source).not.toContain("@/hooks/useToolCatalog");
    expect(source).not.toContain("@/components/tools/");
    expect(source).not.toContain("@/store/tools");
    expect(source).not.toContain("@/types/tools");
  });
});
