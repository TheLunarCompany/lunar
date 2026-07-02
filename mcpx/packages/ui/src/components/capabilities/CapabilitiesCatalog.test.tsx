import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CapabilitiesCatalog } from "./CapabilitiesCatalog";
import type {
  CapabilityGroup,
  CapabilityItem,
  CapabilityProvider,
} from "./types";

const updateCustomCapabilityToolMock = vi.hoisted(() => vi.fn());

vi.mock("./capability-actions", () => ({
  createCustomCapabilityTool: vi.fn(),
  updateCustomCapabilityTool: updateCustomCapabilityToolMock,
  deleteCustomCapabilityTool: vi.fn(),
}));

const catalogState = vi.hoisted(() => ({
  providers: [] as CapabilityProvider[],
  groups: [] as CapabilityGroup[],
  visibleProviders: [] as CapabilityProvider[],
  searchQuery: "",
  setSearchQuery: vi.fn(),
  annotationFilter: [],
  setAnnotationFilter: vi.fn(),
  expandedProviders: new Set<string>(),
  expandProviderSections: vi.fn(),
  clearProviderExpansion: vi.fn(),
  toggleProviderExpansion: vi.fn(),
  selectedGroupName: null as string | null,
  selectedGroup: null as CapabilityGroup | null,
  selectGroup: vi.fn(),
  selectedCapabilityKeys: new Set<string>(),
  setSelectedCapabilityKeys: vi.fn(),
  toggleCapabilitySelection: vi.fn(),
  startCreatingGroup: vi.fn(),
  startEditingGroup: vi.fn(),
  editingGroup: null as CapabilityGroup | null,
  createGroup: vi.fn(),
  updateEditingGroup: vi.fn(),
  deleteGroup: vi.fn(),
  createGroupError: null as string | null,
  editGroupError: null as string | null,
  isCreatingGroup: false,
  isUpdatingGroup: false,
  isDeletingGroup: false,
  dismissToasts: vi.fn(),
}));

vi.mock("./useCapabilitiesCatalog", () => ({
  useCapabilitiesCatalog: () => catalogState,
}));

const provider: CapabilityProvider = {
  name: "filesystem",
  state: { type: "connected" },
  items: [
    {
      id: "filesystem:safe_read",
      kind: "tool",
      name: "safe_read",
      description: "Read a file safely",
      providerName: "filesystem",
      isCustom: true,
      originalToolName: "read_file",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
        },
      },
      annotations: { readOnlyHint: true },
      overrideParams: {
        path: {
          value: "/safe/current",
          description: { action: "rewrite", text: "Saved path override" },
        },
      },
    } as CapabilityItem,
    {
      id: "filesystem:read_file",
      kind: "tool",
      name: "read_file",
      description: "Read a file",
      providerName: "filesystem",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
        },
      },
      annotations: { readOnlyHint: true },
    },
    {
      id: "filesystem:delete_file",
      kind: "tool",
      name: "delete_file",
      description: "Delete a file",
      providerName: "filesystem",
      inputSchema: { type: "object" },
      annotations: { destructiveHint: true },
    },
  ],
};

const group: CapabilityGroup = {
  id: "tool_group_0",
  name: "File tools",
  description: "Filesystem access",
  services: { filesystem: ["safe_read", "delete_file"] },
  providers: [
    {
      providerName: "filesystem",
      itemCount: 2,
      itemNames: ["safe_read", "delete_file"],
      selectionKeys: ["filesystem:safe_read", "filesystem:delete_file"],
    },
  ],
};

describe("CapabilitiesCatalog", () => {
  beforeEach(() => {
    Object.assign(catalogState, {
      providers: [provider],
      groups: [group],
      visibleProviders: [provider],
      expandedProviders: new Set(["filesystem"]),
      selectedGroupName: null,
      selectedGroup: null,
      selectedCapabilityKeys: new Set(),
      createGroupError: null,
      editGroupError: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the capability-oriented page labels and action buttons", () => {
    render(<CapabilitiesCatalog />);

    expect(
      screen.getByText("Capabilities", { selector: "p" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Custom Tool" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Capability Group" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Capabilities Groups")).toBeInTheDocument();
    expect(screen.getByText("Capabilities Catalog")).toBeInTheDocument();
  });

  it("renders provider cards, item cards, annotation badges, custom badge, and item menu labels", () => {
    render(<CapabilitiesCatalog />);

    expect(screen.getAllByText("filesystem").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Tools: 3")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse filesystem tools" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Connected").closest("[data-slot='badge']"),
    ).toHaveClass("bg-(--color-bg-success)");
    expect(
      screen.getByRole("img", { name: "filesystem fallback logo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("safe_read")).toBeInTheDocument();
    expect(screen.getByText("Read a file safely")).toBeInTheDocument();
    expect(screen.getAllByText("READ ONLY").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Input fields: 1").length).toBe(2);
    expect(screen.getAllByLabelText("Messages: 0").length).toBe(3);
    expect(
      screen.getAllByLabelText("Resources: 0").length,
    ).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("CUSTOM")).toBeInTheDocument();
    expect(screen.getByLabelText("Custom capability icon")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Open safe_read menu" }),
    );

    expect(
      screen.getByRole("menuitem", { name: "Details" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Delete" }),
    ).toBeInTheDocument();
  });

  it("splits provider capabilities into tool, prompt, and disabled resource tabs", async () => {
    const mixedProvider: CapabilityProvider = {
      name: "github",
      state: { type: "connected" },
      items: [
        {
          id: "github:create_repository",
          kind: "tool",
          name: "create_repository",
          description: "Create a repository",
          providerName: "github",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
          },
          annotations: { readOnlyHint: true },
        },
        {
          id: "github:release_prompt",
          kind: "prompt",
          name: "release_prompt",
          description: "Prepare release notes",
          providerName: "github",
          inputSchema: { type: "object" },
          annotations: {},
        },
      ],
    };

    Object.assign(catalogState, {
      providers: [mixedProvider],
      visibleProviders: [mixedProvider],
      expandedProviders: new Set(["github"]),
    });

    render(<CapabilitiesCatalog />);

    expect(screen.getByRole("tab", { name: "Tools 1" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("create_repository")).toBeInTheDocument();
    expect(screen.queryByText("release_prompt")).not.toBeInTheDocument();
    expect(
      screen.getByText("create_repository").parentElement?.className,
    ).toContain("--colors-primary-100");

    fireEvent.click(screen.getByRole("tab", { name: "Prompts 1" }));

    expect(screen.getByRole("tab", { name: "Prompts 1" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("release_prompt")).toBeInTheDocument();
    expect(screen.queryByText("create_repository")).not.toBeInTheDocument();
    expect(
      screen.getByText("release_prompt").parentElement?.className,
    ).toContain("--colors-success-100");

    const resourcesTab = screen.getByRole("tab", { name: "Resources" });
    expect(resourcesTab).toBeDisabled();

    fireEvent.pointerMove(resourcesTab.parentElement ?? resourcesTab);

    expect((await screen.findAllByText("Coming soon")).length).toBeGreaterThan(
      0,
    );
  });

  it("renders semantic color indicators for annotation filter options", async () => {
    render(<CapabilitiesCatalog />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Filter Tools" }));

    const expectedDotClasses = {
      "Read-only": "bg-green-500",
      Write: "bg-amber-500",
      Destructive: "bg-red-500",
    };

    await screen.findByRole("menuitemcheckbox", { name: "Read-only" });

    Object.entries(expectedDotClasses).forEach(([label, dotClass]) => {
      const option = screen.getByRole("menuitemcheckbox", { name: label });
      expect(option.querySelector(".rounded-full")).toHaveClass(dotClass);
    });
  });

  it("renders server logos in provider headers when a known logo exists", () => {
    const githubProvider: CapabilityProvider = {
      ...provider,
      name: "github",
      items: provider.items.map((item) => ({
        ...item,
        providerName: "github",
      })),
    };

    Object.assign(catalogState, {
      providers: [githubProvider],
      visibleProviders: [githubProvider],
      expandedProviders: new Set(["github"]),
    });

    render(<CapabilitiesCatalog />);

    expect(
      screen.getByRole("img", { name: "github favicon" }),
    ).toBeInTheDocument();
  });

  it("renders a colored pending auth provider status badge", () => {
    const pendingProvider: CapabilityProvider = {
      ...provider,
      state: { type: "pending-auth" },
    };

    Object.assign(catalogState, {
      providers: [pendingProvider],
      visibleProviders: [pendingProvider],
      expandedProviders: new Set(["filesystem"]),
    });

    render(<CapabilitiesCatalog />);

    expect(
      screen.getByText("Pending Auth").closest("[data-slot='badge']"),
    ).toHaveClass("bg-(--colors-info-50)");
  });

  it("renders empty states when provider and group data are missing", () => {
    Object.assign(catalogState, {
      providers: [],
      groups: [],
      visibleProviders: [],
      expandedProviders: new Set(),
    });

    render(<CapabilitiesCatalog />);

    expect(screen.getByText("No Capability Groups yet")).toBeInTheDocument();
    expect(screen.getByText("No tools available")).toBeInTheDocument();
  });

  it("opens group details without filtering the tool catalog", () => {
    render(<CapabilitiesCatalog />);

    fireEvent.click(screen.getByRole("button", { name: "Open File tools" }));

    expect(catalogState.selectGroup).not.toHaveBeenCalled();
  });

  it("expands provider sections when entering add custom tool or create group mode", () => {
    Object.assign(catalogState, {
      expandedProviders: new Set(["filesystem"]),
      selectedGroupName: "File tools",
      selectedGroup: group,
    });

    render(<CapabilitiesCatalog />);

    fireEvent.click(screen.getByRole("button", { name: "Add Custom Tool" }));
    expect(catalogState.expandProviderSections).toHaveBeenCalledTimes(1);
    expect(catalogState.clearProviderExpansion).not.toHaveBeenCalled();
    expect(catalogState.selectGroup).toHaveBeenCalledWith(null);
    expect(catalogState.toggleProviderExpansion).not.toHaveBeenCalled();

    cleanup();
    vi.clearAllMocks();
    Object.assign(catalogState, {
      selectedGroupName: "File tools",
      selectedGroup: group,
    });

    render(<CapabilitiesCatalog />);
    fireEvent.click(
      screen.getByRole("button", { name: "Create Capability Group" }),
    );

    expect(catalogState.expandProviderSections).toHaveBeenCalledTimes(1);
    expect(catalogState.clearProviderExpansion).not.toHaveBeenCalled();
    expect(catalogState.selectGroup).toHaveBeenCalledWith(null);
    expect(catalogState.toggleProviderExpansion).not.toHaveBeenCalled();
  });

  it("expands provider sections when updating tools for a group", () => {
    Object.assign(catalogState, {
      expandedProviders: new Set(),
      selectedGroupName: "File tools",
      selectedGroup: group,
    });

    render(<CapabilitiesCatalog />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open File tools menu" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Update Tools" }));

    expect(catalogState.startEditingGroup).toHaveBeenCalledWith("File tools");
    expect(catalogState.expandProviderSections).toHaveBeenCalledTimes(1);
    expect(catalogState.clearProviderExpansion).not.toHaveBeenCalled();
  });

  it("does not show the selected tools save panel when editing group metadata", () => {
    Object.assign(catalogState, {
      editingGroup: group,
      selectedCapabilityKeys: new Set(["filesystem:safe_read"]),
    });

    render(<CapabilitiesCatalog />);

    expect(
      screen.queryByRole("button", { name: "Save Changes" }),
    ).not.toBeInTheDocument();
  });

  it("collapses provider sections when canceling selection mode", () => {
    render(<CapabilitiesCatalog />);

    fireEvent.click(screen.getByRole("button", { name: "Add Custom Tool" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(catalogState.clearProviderExpansion).toHaveBeenCalledTimes(1);
    expect(catalogState.setSelectedCapabilityKeys).toHaveBeenCalledWith(
      new Set(),
    );

    cleanup();
    vi.clearAllMocks();

    render(<CapabilitiesCatalog />);
    fireEvent.click(
      screen.getByRole("button", { name: "Create Capability Group" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(catalogState.clearProviderExpansion).toHaveBeenCalledTimes(1);
    expect(catalogState.setSelectedCapabilityKeys).toHaveBeenCalledWith(
      new Set(),
    );
  });

  it("returns to the default catalog state when closing the selected tools panel", () => {
    Object.assign(catalogState, {
      editingGroup: group,
      selectedCapabilityKeys: new Set(["filesystem:safe_read"]),
    });

    render(<CapabilitiesCatalog />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open File tools menu" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Update Tools" }));
    fireEvent.click(screen.getByTitle("Clear all selected tools"));

    expect(catalogState.clearProviderExpansion).toHaveBeenCalledTimes(1);
    expect(catalogState.setSelectedCapabilityKeys).toHaveBeenCalledWith(
      new Set(),
    );
  });

  it("collapses provider sections after saving group tool changes", async () => {
    Object.assign(catalogState, {
      editingGroup: group,
      selectedCapabilityKeys: new Set(["filesystem:safe_read"]),
    });
    catalogState.updateEditingGroup.mockResolvedValue(true);

    render(<CapabilitiesCatalog />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open File tools menu" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Update Tools" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(catalogState.updateEditingGroup).toHaveBeenCalledWith({
        name: "File tools",
        description: "Filesystem access",
      });
    });
    expect(catalogState.clearProviderExpansion).toHaveBeenCalledTimes(1);
    expect(catalogState.setSelectedCapabilityKeys).toHaveBeenCalledWith(
      new Set(),
    );
  });

  it("prefills and preserves existing custom tool parameter overrides when editing", async () => {
    render(<CapabilitiesCatalog />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open safe_read menu" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(screen.getByDisplayValue("/safe/current")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Saved path override")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateCustomCapabilityToolMock).toHaveBeenCalledWith({
        providerName: "filesystem",
        baseCapabilityName: "read_file",
        customCapabilityName: "safe_read",
        updates: {
          description: {
            action: "rewrite",
            text: "Read a file safely",
          },
          overrideParams: {
            path: {
              value: "/safe/current",
              description: {
                action: "rewrite",
                text: "Saved path override",
              },
            },
          },
        },
      });
    });
  });

  it("uses encoded selection keys for provider and tool names containing colons", () => {
    const colonProvider: CapabilityProvider = {
      name: "github:prod",
      state: { type: "connected" },
      items: [
        {
          id: "github%3Aprod:run%3Atool",
          kind: "tool",
          name: "run:tool",
          description: "Run tool",
          providerName: "github:prod",
          inputSchema: { type: "object" },
          annotations: {},
        },
      ],
    };

    Object.assign(catalogState, {
      providers: [colonProvider],
      groups: [],
      visibleProviders: [colonProvider],
      expandedProviders: new Set(["github:prod"]),
      selectedCapabilityKeys: new Set(["github%3Aprod:run%3Atool"]),
    });

    render(<CapabilitiesCatalog />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Create Capability Group" })[0],
    );
    const selectedItem = screen.getByRole("checkbox", { name: "run:tool" });
    expect(selectedItem).toHaveAttribute("aria-checked", "true");

    fireEvent.click(selectedItem);

    expect(catalogState.toggleCapabilitySelection).toHaveBeenCalledWith(
      "github%3Aprod:run%3Atool",
      false,
    );
  });
});
