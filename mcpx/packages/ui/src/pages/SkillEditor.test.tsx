import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Skill, SystemState } from "@mcpx/shared-model";
import {
  createMemoryRouter,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useCreateSkill,
  useEnabledSkills,
  useSkill,
  useUpdateSkillDetails,
} from "@/data/skills";
import { useGetMCPServers } from "@/data/catalog-servers";
import { toast } from "@/components/ui/use-toast";
import SkillEditor from "./SkillEditor";

const mockSocket = vi.hoisted(() => ({
  state: {
    appConfig: undefined,
    systemState: undefined as SystemState | undefined,
  },
}));

vi.mock("@/data/skills", () => ({
  useSkill: vi.fn(),
  useCreateSkill: vi.fn(),
  useEnabledSkills: vi.fn(),
  useUpdateSkillDetails: vi.fn(),
}));
vi.mock("@/components/ui/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/data/catalog-servers", () => ({ useGetMCPServers: vi.fn() }));
vi.mock("@/store", () => ({
  useSocketStore: (selector: (state: typeof mockSocket.state) => unknown) =>
    selector(mockSocket.state),
}));
vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: () => undefined,
}));

const idleMutation = { mutateAsync: vi.fn(), isPending: false };

describe("SkillEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateSkill).mockReturnValue(idleMutation as never);
    vi.mocked(useUpdateSkillDetails).mockReturnValue(idleMutation as never);
    vi.mocked(useSkill).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useEnabledSkills).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useGetMCPServers).mockReturnValue({ data: [] } as never);
    mockSocket.state.appConfig = undefined;
    mockSocket.state.systemState = undefined;
  });

  it("renders the create form without capability controls on /skills/new/blank", () => {
    const { container } = renderEditorRoute("/skills/new/blank");

    expect(
      container.querySelector('[data-slot="skill-page-root"]'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create skill" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Add a new skill" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "MCP capabilities" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "MCP capabilities" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("skill-file-structure"),
    ).not.toBeInTheDocument();
  });

  it("creates a details-only skill and navigates to the skill detail page", async () => {
    const user = userEvent.setup();
    const createMutation = {
      mutateAsync: vi.fn().mockResolvedValue(
        existingSkill({
          name: "repo-review",
          description: "Review repository changes",
          body: "# Review\nCheck the repository changes.",
        }),
      ),
      isPending: false,
    };
    vi.mocked(useCreateSkill).mockReturnValue(createMutation as never);

    renderEditorRoute("/skills/new/blank");

    await fillSkillForm(user);
    await user.click(screen.getByRole("button", { name: "Create skill" }));

    expect(createMutation.mutateAsync).toHaveBeenCalledWith({
      name: "repo-review",
      description: "Review repository changes",
      body: "# Review\nCheck the repository changes.",
      exposeAsPrompt: true,
    });
    expect(toast).toHaveBeenCalledWith({
      title: "Skill created",
      description: "Skill details are ready.",
    });
    expect(await screen.findByText("Skill detail")).toBeInTheDocument();
  });

  it("shows a toast when creating a skill fails", async () => {
    const user = userEvent.setup();
    const createMutation = {
      mutateAsync: vi.fn().mockRejectedValue(new Error("Create failed")),
      isPending: false,
    };
    vi.mocked(useCreateSkill).mockReturnValue(createMutation as never);

    renderEditorRoute("/skills/new/blank");

    await fillSkillForm(user);
    await user.click(screen.getByRole("button", { name: "Create skill" }));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith({
      title: "Failed to create skill",
      description: "Create failed",
      variant: "destructive",
    });
    expect(screen.queryByText("Capabilities route")).not.toBeInTheDocument();
  });

  it("prefills the upload editor from navigation state", () => {
    renderEditorRoute({
      pathname: "/skills/new/upload",
      state: {
        draft: {
          name: "imported-skill",
          description: "Imported description",
          body: "# Imported",
          exposeAsPrompt: true,
        },
      },
    });

    expect(screen.getByLabelText("Skill name")).toHaveValue("imported-skill");
    expect(screen.getByLabelText("Short description")).toHaveValue(
      "Imported description",
    );
    expect(screen.getByLabelText("Markdown body")).toHaveValue("# Imported");
    expect(
      screen.queryByRole("heading", { name: "MCP capabilities" }),
    ).not.toBeInTheDocument();
  });

  it("renders the edit form with a header save action on /skills/:id/edit", () => {
    vi.mocked(useSkill).mockReturnValue({
      data: existingSkill(),
      isLoading: false,
      isError: false,
    } as never);

    const { container } = renderEditorRoute(
      "/skills/0190a000-0000-7000-8000-000000000001/edit",
    );

    const breadcrumbs = screen.getByRole("navigation", {
      name: "Breadcrumb",
    });
    expect(
      screen.getByRole("link", { name: "Back to existing" }),
    ).toHaveAttribute("href", "/skills/0190a000-0000-7000-8000-000000000001");
    expect(
      within(breadcrumbs).getByRole("link", { name: "Skills" }),
    ).toHaveAttribute("href", "/skills");
    expect(
      within(breadcrumbs).getByRole("link", { name: "existing" }),
    ).toHaveAttribute("href", "/skills/0190a000-0000-7000-8000-000000000001");
    expect(within(breadcrumbs).getByText("Edit")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.queryByRole("heading", { name: "existing", level: 2 }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("EX")).not.toBeInTheDocument();
    expect(screen.queryByText("Maintained by")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete skill" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Skill name")).toHaveValue("existing");
    expect(
      screen.getAllByRole("button", { name: "Save changes" }),
    ).toHaveLength(2);
    expect(
      within(
        container.querySelector('[data-slot="skill-page-header"]')!,
      ).getByRole("button", { name: "Save changes" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "MCP capabilities" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Back to skill" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "MCP capabilities" }),
    ).not.toBeInTheDocument();
    const fileStructureCard = screen.getByTestId("skill-file-structure");
    expect(
      within(fileStructureCard).getByRole("heading", {
        name: "Skill file structure",
      }),
    ).toBeInTheDocument();
    expect(within(fileStructureCard).getByText("existing")).toBeInTheDocument();
    expect(within(fileStructureCard).getByText("SKILL.md")).toBeInTheDocument();
  });

  it("renders applied agents and navigates to their manager from the edit view", async () => {
    const user = userEvent.setup();
    const skill = existingSkill();
    const subject = { kind: "clientName" as const, value: "cursor" };
    vi.mocked(useSkill).mockReturnValue({
      data: skill,
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useEnabledSkills).mockReturnValue({
      data: [{ subject, skillIds: [skill.id] }],
      isLoading: false,
      isError: false,
    } as never);

    renderEditorRoute(`/skills/${skill.id}/edit`);

    const appliedAgents = screen.getByTestId("applied-agents");
    expect(within(appliedAgents).getByText("cursor")).toBeInTheDocument();
    await user.click(
      within(appliedAgents).getByRole("button", {
        name: "Manage agents",
      }),
    );

    expect(await screen.findByText("Agents editor")).toBeInTheDocument();
  });

  it("saves only skill details when an existing skill has capabilities", async () => {
    const user = userEvent.setup();
    const updateMutation = { mutateAsync: vi.fn(), isPending: false };
    const skill = existingSkill({
      capabilityGroup: {
        name: "Legacy group name",
        items: [
          {
            catalogItemId: "0190a000-0000-7000-8000-000000000010",
            tools: "*",
            prompts: ["issue_template"],
          },
        ],
      },
    });
    vi.mocked(useSkill).mockReturnValue({
      data: skill,
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useUpdateSkillDetails).mockReturnValue(updateMutation as never);

    renderEditorRoute("/skills/0190a000-0000-7000-8000-000000000001/edit");

    await user.clear(screen.getByLabelText("Short description"));
    await user.type(screen.getByLabelText("Short description"), "Updated desc");
    await user.click(getBottomSaveChangesButton());

    await waitFor(() => expect(updateMutation.mutateAsync).toHaveBeenCalled());
    expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
      id: skill.id,
      draft: {
        name: "existing",
        description: "Updated desc",
        body: "# Existing",
        exposeAsPrompt: true,
      },
    });
    expect(await screen.findByText("Skills list")).toBeInTheDocument();
  });

  it("shows read-only linked capabilities and navigates to their editor", async () => {
    const user = userEvent.setup();
    const catalogItemId = "0190a000-0000-7000-8000-000000000010";
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
    vi.mocked(useGetMCPServers).mockReturnValue({
      data: [
        {
          id: catalogItemId,
          name: "github",
          displayName: "GitHub",
          config: {},
        },
      ],
    } as never);
    mockSocket.state.systemState = {
      targetServers: [
        {
          _type: "stdio",
          name: "github",
          catalogItemId,
          command: "npx",
          state: { type: "connected" },
          tools: [
            {
              name: "search_repositories",
              usage: { callCount: 0 },
              inputSchema: { type: "object" },
            },
          ],
          originalTools: [],
          prompts: [],
          originalPrompts: [],
          usage: { callCount: 0 },
        },
      ],
    } as unknown as SystemState;

    renderEditorRoute("/skills/0190a000-0000-7000-8000-000000000001/edit");

    const linkedCapabilities = screen.getByTestId("linked-mcp-capabilities");
    expect(
      within(linkedCapabilities).getByRole("button", {
        name: "Link capabilities",
      }),
    ).toBeInTheDocument();
    expect(
      within(linkedCapabilities).queryByRole("button", {
        name: "Unlink github capabilities",
      }),
    ).not.toBeInTheDocument();

    await user.click(
      within(linkedCapabilities).getByRole("button", {
        name: "Filter by GitHub",
      }),
    );

    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/skills/0190a000-0000-7000-8000-000000000001/capabilities?mcp=GitHub",
    );
  });

  it("navigates to the capabilities editor from Link capabilities", async () => {
    const user = userEvent.setup();
    vi.mocked(useSkill).mockReturnValue({
      data: existingSkill(),
      isLoading: false,
      isError: false,
    } as never);

    renderEditorRoute("/skills/0190a000-0000-7000-8000-000000000001/edit");

    await user.click(
      within(screen.getByTestId("linked-mcp-capabilities")).getByRole(
        "button",
        { name: "Link capabilities" },
      ),
    );

    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/skills/0190a000-0000-7000-8000-000000000001/capabilities",
    );
  });
});

function renderEditorRoute(
  initialEntry:
    | string
    | {
        pathname: string;
        state?: unknown;
      },
) {
  const router = createMemoryRouter(
    [
      { path: "/skills/new/blank", element: <SkillEditor /> },
      { path: "/skills/new/upload", element: <SkillEditor /> },
      { path: "/skills/:id", element: <div>Skill detail</div> },
      { path: "/skills/:id/edit", element: <SkillEditor /> },
      {
        path: "/skills/:id/capabilities",
        element: <CapabilitiesRoute />,
      },
      {
        path: "/skills/:id/agents",
        element: <div>Agents editor</div>,
      },
      { path: "/skills", element: <div>Skills list</div> },
    ],
    { initialEntries: [initialEntry] },
  );

  return render(<RouterProvider router={router} />);
}

function CapabilitiesRoute() {
  const location = useLocation();

  return (
    <output data-testid="location">{`${location.pathname}${location.search}`}</output>
  );
}

function getBottomSaveChangesButton() {
  const buttons = screen.getAllByRole("button", { name: "Save changes" });
  return buttons[buttons.length - 1];
}

async function fillSkillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Skill name"), "repo-review");
  await user.type(
    screen.getByLabelText("Short description"),
    "Review repository changes",
  );
  await user.type(
    screen.getByLabelText("Markdown body"),
    "# Review\nCheck the repository changes.",
  );
}

function existingSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "0190a000-0000-7000-8000-000000000001",
    name: "existing",
    description: "desc",
    body: "# Existing",
    exposeAsPrompt: true,
    author: { setupOwnerId: "o", displayName: "Amir" },
    updatedAt: new Date("2026-07-07T00:00:00.000Z"),
    ...overrides,
  };
}
