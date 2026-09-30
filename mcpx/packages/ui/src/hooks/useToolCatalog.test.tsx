import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { accessControlsStore } from "@/store/access-controls";
import { socketStore } from "@/store/socket";
import { apiClient } from "@/lib/api";
import { useToolCatalog } from "./useToolCatalog";

vi.mock("@/lib/api", () => ({
  apiClient: {
    updateToolGroup: vi.fn(),
    createToolGroup: vi.fn(),
    deleteToolGroup: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient);

// Must be a stable reference across renders: the hook depends on `toolsList`
// identity, and a fresh array/object literal on every render would cause an
// effect loop unrelated to what this test is verifying.
const EMPTY_TOOLS_LIST: never[] = [];

const READERS_GROUP = {
  id: "group-1",
  name: "Readers",
  description: "Read access",
  services: {
    filesystem: ["read_file", "list_dir"],
  },
};

function seedData() {
  accessControlsStore.setState({ toolGroups: [READERS_GROUP], profiles: [] });

  socketStore.setState({
    appConfig: {
      permissions: {
        default: { _type: "default-allow", block: [] },
        consumers: {},
        clientNames: {},
      },
      toolExtensions: { services: {} },
      toolGroups: [READERS_GROUP],
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
              annotations: {},
            },
            {
              name: "list_dir",
              description: "List a directory",
              inputSchema: { type: "object" },
              annotations: {},
            },
            {
              name: "write_file",
              description: "Write a file",
              inputSchema: { type: "object" },
              annotations: {},
            },
          ],
          tools: [
            {
              name: "read_file",
              description: "Read a file",
              inputSchema: { type: "object" },
              annotations: {},
              usage: { callCount: 0 },
            },
            {
              name: "list_dir",
              description: "List a directory",
              inputSchema: { type: "object" },
              annotations: {},
              usage: { callCount: 0 },
            },
            {
              name: "write_file",
              description: "Write a file",
              inputSchema: { type: "object" },
              annotations: {},
              usage: { callCount: 0 },
            },
          ],
        },
      ],
    } as never,
  });
}

describe("useToolCatalog - editing a tool group's tools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    accessControlsStore.setState({
      toolGroups: [],
      profiles: [],
      hasPendingChanges: false,
    });
    socketStore.setState({ appConfig: null, systemState: null });
  });

  afterEach(() => {
    accessControlsStore.setState({
      toolGroups: [],
      profiles: [],
      hasPendingChanges: false,
    });
    socketStore.setState({ appConfig: null, systemState: null });
  });

  it("keeps the group's existing tools selected while searching for a new tool to add, and saves the merged set", async () => {
    seedData();
    const { result } = renderHook(() => useToolCatalog(EMPTY_TOOLS_LIST));

    // Open "Update Tools" on the existing group - it should pre-select its
    // current tools.
    act(() => {
      result.current.handleEditGroup(result.current.toolGroups[0]);
    });

    expect(Array.from(result.current.selectedTools).sort()).toEqual([
      "filesystem:list_dir",
      "filesystem:read_file",
    ]);

    // Regression for the reported bug: searching for a specific tool to add
    // must not silently clear the tools already selected in the group.
    act(() => {
      result.current.setSearchQuery("write");
    });

    expect(Array.from(result.current.selectedTools).sort()).toEqual([
      "filesystem:list_dir",
      "filesystem:read_file",
    ]);

    // Select the newly found tool to add it to the group.
    act(() => {
      result.current.handleToolSelectionChange(
        { name: "write_file" } as never,
        "filesystem",
        true,
      );
    });

    expect(Array.from(result.current.selectedTools).sort()).toEqual([
      "filesystem:list_dir",
      "filesystem:read_file",
      "filesystem:write_file",
    ]);

    mockedApiClient.updateToolGroup.mockResolvedValue({
      ...READERS_GROUP,
      services: { filesystem: ["read_file", "list_dir", "write_file"] },
    });

    await act(async () => {
      await result.current.handleSaveGroupChanges();
    });

    // The saved group must contain the original tools PLUS the new one, not
    // just the newly selected tool.
    expect(mockedApiClient.updateToolGroup).toHaveBeenCalledWith("Readers", {
      services: {
        filesystem: ["read_file", "list_dir", "write_file"],
      },
    });
  });
});
