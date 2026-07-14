import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppConfig, Skill, SystemState } from "@mcpx/shared-model";
import {
  NuqsTestingAdapter,
  type OnUrlUpdateFunction,
} from "nuqs/adapters/testing";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGetMCPServers } from "@/data/catalog-servers";
import { useSkill, useUpdateSkillCapabilities } from "@/data/skills";
import { toast } from "@/components/ui/use-toast";
import SkillCapabilitiesEditor from "./SkillCapabilitiesEditor";

const mockSocket = vi.hoisted(() => ({
  state: {
    appConfig: undefined as AppConfig | undefined,
    systemState: undefined as SystemState | undefined,
  },
}));

vi.mock("@/data/skills", () => ({
  useSkill: vi.fn(),
  useUpdateSkillCapabilities: vi.fn(),
}));
vi.mock("@/data/catalog-servers", () => ({
  useGetMCPServers: vi.fn(),
}));
vi.mock("@/components/ui/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: () => undefined,
}));
vi.mock("@/store", () => ({
  useSocketStore: (selector: (state: typeof mockSocket.state) => unknown) =>
    selector(mockSocket.state),
}));

const idleMutation = { mutateAsync: vi.fn(), isPending: false };

describe("SkillCapabilitiesEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.state.appConfig = undefined;
    mockSocket.state.systemState = systemState();
    vi.mocked(useGetMCPServers).mockReturnValue({
      data: [],
    } as never);
    vi.mocked(useUpdateSkillCapabilities).mockReturnValue(
      idleMutation as never,
    );
    vi.mocked(useSkill).mockReturnValue({
      data: existingSkill(),
      isLoading: false,
      isError: false,
    } as never);
  });

  it("renders the existing back link and header save/cancel actions", () => {
    renderCapabilitiesRoute();

    expect(
      screen.getByRole("link", { name: "Back to existing" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Cancel" })).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: "Save capabilities" }),
    ).toHaveLength(1);
  });

  it("cancels from the header action area", async () => {
    const user = userEvent.setup();

    renderCapabilitiesRoute();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Details route")).toBeInTheDocument();
    expect(idleMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("saves selected capabilities without sending skill details", async () => {
    const user = userEvent.setup();
    const updateMutation = { mutateAsync: vi.fn(), isPending: false };
    mockSocket.state.systemState = systemState({
      targetServers: [
        targetServer({
          name: "github",
          catalogItemId,
          toolNames: ["search_repositories"],
          promptNames: ["write_pull_request"],
        }),
      ],
    });
    vi.mocked(useUpdateSkillCapabilities).mockReturnValue(
      updateMutation as never,
    );

    renderCapabilitiesRoute();

    await user.click(
      screen.getByRole("button", { name: /github 0 of 2 selected/i }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: "Select tool search_repositories",
      }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: "Select prompt write_pull_request",
      }),
    );
    await user.click(getSaveCapabilitiesButton());

    await waitFor(() => expect(updateMutation.mutateAsync).toHaveBeenCalled());
    expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
      id: "0190a000-0000-7000-8000-000000000001",
      capabilityGroup: {
        items: [
          {
            catalogItemId,
            tools: ["search_repositories"],
            prompts: ["write_pull_request"],
          },
        ],
      },
    });
    expect(
      updateMutation.mutateAsync.mock.calls[0]?.[0].capabilityGroup,
    ).not.toHaveProperty("name");
    expect(toast).toHaveBeenCalledWith({
      title: "Skill capabilities updated",
      description: "MCP capabilities were saved for this skill.",
    });
  });

  it("removes capabilityGroup when all selected capabilities are cleared", async () => {
    const user = userEvent.setup();
    const updateMutation = { mutateAsync: vi.fn(), isPending: false };
    mockSocket.state.systemState = systemState({
      targetServers: [
        targetServer({
          name: "github",
          catalogItemId,
          toolNames: ["search_repositories"],
        }),
      ],
    });
    vi.mocked(useUpdateSkillCapabilities).mockReturnValue(
      updateMutation as never,
    );
    vi.mocked(useSkill).mockReturnValue({
      data: existingSkill({
        capabilityGroup: {
          name: "Legacy name",
          items: [
            {
              catalogItemId,
              tools: ["search_repositories"],
              prompts: [],
            },
          ],
        },
      }),
      isLoading: false,
      isError: false,
    } as never);

    renderCapabilitiesRoute();

    await user.click(
      await screen.findByRole("checkbox", {
        name: "Select tool search_repositories",
      }),
    );
    await user.click(getSaveCapabilitiesButton());

    await waitFor(() => expect(updateMutation.mutateAsync).toHaveBeenCalled());
    expect(updateMutation.mutateAsync.mock.calls[0]?.[0]).toEqual({
      id: "0190a000-0000-7000-8000-000000000001",
      capabilityGroup: null,
    });
  });

  it("lists selected MCP servers and filters the picker when a linked server is clicked", async () => {
    const user = userEvent.setup();
    mockSocket.state.systemState = systemState({
      targetServers: [
        targetServer({
          name: "github",
          catalogItemId,
          toolNames: ["search_repositories"],
          promptNames: ["write_pull_request"],
        }),
        targetServer({
          name: "linear",
          catalogItemId: linearCatalogItemId,
          toolNames: ["list_issues"],
        }),
      ],
    });
    vi.mocked(useSkill).mockReturnValue({
      data: existingSkill({
        capabilityGroup: {
          items: [
            {
              catalogItemId,
              tools: ["search_repositories"],
              prompts: ["write_pull_request"],
            },
            {
              catalogItemId: linearCatalogItemId,
              tools: ["list_issues"],
              prompts: [],
            },
          ],
        },
      }),
      isLoading: false,
      isError: false,
    } as never);

    renderCapabilitiesRoute();

    const linkedCard = screen.getByTestId("linked-mcp-capabilities");
    expect(
      within(linkedCard).getByRole("heading", {
        name: "Linked MCP capabilities",
      }),
    ).toBeInTheDocument();
    expect(within(linkedCard).getAllByText("2").length).toBeGreaterThan(0);
    expect(
      within(linkedCard).getByRole("button", { name: /filter by github/i }),
    ).toHaveTextContent("2");
    expect(
      within(linkedCard).getByRole("button", { name: /filter by linear/i }),
    ).toHaveTextContent("1");

    await user.click(
      within(linkedCard).getByRole("button", { name: /filter by linear/i }),
    );

    expect(
      screen.queryByTestId("skill-capability-provider-github"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("skill-capability-provider-linear"),
    ).toBeInTheDocument();
    expect(screen.getByText("list_issues")).toBeVisible();
  });

  it("stores multiple selected MCP server filters in the URL", async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    mockSocket.state.systemState = systemState({
      targetServers: [
        targetServer({
          name: "github",
          catalogItemId,
          toolNames: ["search_repositories"],
        }),
        targetServer({
          name: "linear",
          catalogItemId: linearCatalogItemId,
          toolNames: ["list_issues"],
        }),
      ],
    });

    renderCapabilitiesRoute({ onUrlUpdate, hasMemory: true });

    const providerFilter = screen.getByRole("combobox", {
      name: "Filter MCP servers",
    });
    await user.click(providerFilter);
    await user.click(screen.getByRole("option", { name: "github" }));
    await user.click(providerFilter);
    await user.click(screen.getByRole("option", { name: "linear" }));

    const latestUpdate =
      onUrlUpdate.mock.calls[onUrlUpdate.mock.calls.length - 1]?.[0];
    expect(latestUpdate?.searchParams.getAll("mcp")).toEqual([
      "github",
      "linear",
    ]);
  });

  it("unlinks all selected capabilities for a server from the linked capabilities card", async () => {
    const user = userEvent.setup();
    const updateMutation = { mutateAsync: vi.fn(), isPending: false };
    mockSocket.state.systemState = systemState({
      targetServers: [
        targetServer({
          name: "github",
          catalogItemId,
          toolNames: ["search_repositories"],
          promptNames: ["write_pull_request"],
        }),
        targetServer({
          name: "linear",
          catalogItemId: linearCatalogItemId,
          toolNames: ["list_issues"],
        }),
      ],
    });
    vi.mocked(useUpdateSkillCapabilities).mockReturnValue(
      updateMutation as never,
    );
    vi.mocked(useSkill).mockReturnValue({
      data: existingSkill({
        capabilityGroup: {
          items: [
            {
              catalogItemId,
              tools: ["search_repositories"],
              prompts: ["write_pull_request"],
            },
            {
              catalogItemId: linearCatalogItemId,
              tools: ["list_issues"],
              prompts: [],
            },
          ],
        },
      }),
      isLoading: false,
      isError: false,
    } as never);

    renderCapabilitiesRoute();

    await user.click(
      screen.getByRole("button", { name: /unlink github capabilities/i }),
    );
    await user.click(getSaveCapabilitiesButton());

    await waitFor(() => expect(updateMutation.mutateAsync).toHaveBeenCalled());
    expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
      id: "0190a000-0000-7000-8000-000000000001",
      capabilityGroup: {
        items: [
          {
            catalogItemId: linearCatalogItemId,
            tools: ["list_issues"],
            prompts: [],
          },
        ],
      },
    });
  });

  it("hydrates saved selections when provider data arrives after the skill", async () => {
    vi.mocked(useSkill).mockReturnValue({
      data: existingSkill({
        capabilityGroup: {
          items: [
            {
              catalogItemId,
              tools: ["search_repositories"],
              prompts: [],
            },
          ],
        },
      }),
      isLoading: false,
      isError: false,
    } as never);
    const { rerender } = renderCapabilitiesRoute();

    expect(
      screen.getByText(
        "Saved on this skill but no longer available from this MCP server.",
      ),
    ).toBeInTheDocument();

    mockSocket.state.systemState = systemState({
      targetServers: [
        targetServer({
          name: "github",
          catalogItemId,
          toolNames: ["search_repositories"],
        }),
      ],
    });
    rerender(createCapabilitiesRouterElement());

    const githubSection = screen.getByTestId(
      "skill-capability-provider-github",
    );
    expect(
      await within(githubSection).findByRole("checkbox", {
        name: "Select tool search_repositories",
      }),
    ).toBeChecked();
  });

  it("indicates saved capabilities that are missing from the current MCP state", () => {
    const missingCatalogItemId = "0190a000-0000-7000-8000-000000000099";
    vi.mocked(useGetMCPServers).mockReturnValue({
      data: [
        {
          id: missingCatalogItemId,
          name: "coda",
          displayName: "Coda",
          config: {},
        },
      ],
    } as never);
    vi.mocked(useSkill).mockReturnValue({
      data: existingSkill({
        capabilityGroup: {
          items: [
            {
              catalogItemId: missingCatalogItemId,
              tools: ["archived_tool"],
              prompts: ["archived_prompt"],
            },
          ],
        },
      }),
      isLoading: false,
      isError: false,
    } as never);

    renderCapabilitiesRoute();

    expect(screen.queryByText("Saved but unavailable")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Coda 2 of 2 selected/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(missingCatalogItemId)).not.toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Saved on this skill but no longer available from this MCP server.",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("checkbox", { name: "Select tool archived_tool" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select tool archived_tool" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("checkbox", { name: "Select prompt archived_prompt" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select prompt archived_prompt" }),
    ).toBeEnabled();
  });

  it("updates one saved unavailable capability without clearing the others", async () => {
    const user = userEvent.setup();
    const updateMutation = { mutateAsync: vi.fn(), isPending: false };
    const missingCatalogItemId = "0190a000-0000-7000-8000-000000000099";
    vi.mocked(useGetMCPServers).mockReturnValue({
      data: [
        {
          id: missingCatalogItemId,
          name: "coda",
          displayName: "Coda",
          config: {},
        },
      ],
    } as never);
    vi.mocked(useUpdateSkillCapabilities).mockReturnValue(
      updateMutation as never,
    );
    vi.mocked(useSkill).mockReturnValue({
      data: existingSkill({
        capabilityGroup: {
          items: [
            {
              catalogItemId: missingCatalogItemId,
              tools: ["archived_tool"],
              prompts: ["archived_prompt"],
            },
          ],
        },
      }),
      isLoading: false,
      isError: false,
    } as never);

    renderCapabilitiesRoute();

    await user.click(
      screen.getByRole("checkbox", { name: "Select tool archived_tool" }),
    );
    await user.click(getSaveCapabilitiesButton());

    await waitFor(() => expect(updateMutation.mutateAsync).toHaveBeenCalled());
    expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
      id: "0190a000-0000-7000-8000-000000000001",
      capabilityGroup: {
        items: [
          {
            catalogItemId: missingCatalogItemId,
            tools: [],
            prompts: ["archived_prompt"],
          },
        ],
      },
    });
  });

  it("shows a toast and keeps edits dirty when saving capabilities fails", async () => {
    const user = userEvent.setup();
    const updateMutation = {
      mutateAsync: vi.fn().mockRejectedValue(new Error("Nope")),
      isPending: false,
    };
    mockSocket.state.systemState = systemState({
      targetServers: [
        targetServer({
          name: "github",
          catalogItemId,
          toolNames: ["search_repositories"],
        }),
      ],
    });
    vi.mocked(useUpdateSkillCapabilities).mockReturnValue(
      updateMutation as never,
    );

    renderCapabilitiesRoute();

    await user.click(
      screen.getByRole("button", { name: /github 0 of 1 selected/i }),
    );
    await user.click(screen.getByText("search_repositories"));
    await user.click(getSaveCapabilitiesButton());

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith({
      title: "Failed to update skill capabilities",
      description: "Nope",
      variant: "destructive",
    });
    expect(getSaveCapabilitiesButton()).toBeEnabled();
  });
});

function renderCapabilitiesRoute(
  nuqsOptions: {
    onUrlUpdate?: OnUrlUpdateFunction;
    hasMemory?: boolean;
  } = {},
) {
  return render(createCapabilitiesRouterElement(nuqsOptions));
}

function getSaveCapabilitiesButton() {
  return screen.getByRole("button", { name: "Save capabilities" });
}

function createCapabilitiesRouterElement({
  onUrlUpdate,
  hasMemory,
}: {
  onUrlUpdate?: OnUrlUpdateFunction;
  hasMemory?: boolean;
} = {}) {
  const router = createMemoryRouter(
    [
      {
        path: "/skills/:id/capabilities",
        element: <SkillCapabilitiesEditor />,
      },
      { path: "/skills/:id", element: <div>Details route</div> },
      { path: "/skills", element: <div>Skills list</div> },
    ],
    {
      initialEntries: [
        "/skills/0190a000-0000-7000-8000-000000000001/capabilities",
      ],
    },
  );

  return (
    <NuqsTestingAdapter onUrlUpdate={onUrlUpdate} hasMemory={hasMemory}>
      <RouterProvider router={router} />
    </NuqsTestingAdapter>
  );
}

const catalogItemId = "0190a000-0000-7000-8000-000000000010";
const linearCatalogItemId = "0190a000-0000-7000-8000-000000000011";

function existingSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "0190a000-0000-7000-8000-000000000001",
    name: "existing",
    description: "Existing description",
    body: "# Existing",
    exposeAsPrompt: true,
    author: { setupOwnerId: "o", displayName: "Amir" },
    updatedAt: new Date("2026-07-07T00:00:00.000Z"),
    ...overrides,
  };
}

function systemState(overrides: Partial<SystemState> = {}): SystemState {
  return {
    targetServers: [],
    connectedClients: [],
    connectedClientClusters: [],
    usage: { callCount: 0 },
    lastUpdatedAt: new Date("2026-07-07T00:00:00.000Z"),
    ...overrides,
  };
}

function targetServer({
  name,
  catalogItemId,
  toolNames = [],
  promptNames = [],
}: {
  name: string;
  catalogItemId?: string;
  toolNames?: string[];
  promptNames?: string[];
}): SystemState["targetServers"][number] {
  return {
    _type: "stdio",
    name,
    catalogItemId,
    command: "npx",
    state: { type: "connected" },
    tools: toolNames.map((toolName) => ({
      name: toolName,
      usage: { callCount: 0 },
      inputSchema: { type: "object" },
    })),
    originalTools: toolNames.map((toolName) => ({
      name: toolName,
      inputSchema: { type: "object" },
    })),
    prompts: promptNames.map((promptName) => ({
      name: promptName,
      usage: { callCount: 0 },
    })),
    originalPrompts: [],
    usage: { callCount: 0 },
  };
}
