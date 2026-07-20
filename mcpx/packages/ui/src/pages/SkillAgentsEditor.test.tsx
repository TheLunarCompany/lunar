import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Skill, SystemState } from "@mcpx/shared-model";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useEnabledSkills,
  useSkill,
  useUpdateSkillEnablement,
} from "@/data/skills";
import { toast } from "@/components/ui/use-toast";
import SkillAgentsEditor from "./SkillAgentsEditor";

const mockSocket = vi.hoisted(() => ({
  state: { systemState: undefined as SystemState | undefined },
}));

vi.mock("@/data/skills", () => ({
  useEnabledSkills: vi.fn(),
  useSkill: vi.fn(),
  useUpdateSkillEnablement: vi.fn(),
}));
vi.mock("@/components/ui/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/store", () => ({
  useSocketStore: (selector: (state: typeof mockSocket.state) => unknown) =>
    selector(mockSocket.state),
}));

const skillId = "0190a000-0000-7000-8000-000000000001";
const idleMutation = { mutateAsync: vi.fn(), isPending: false };

describe("SkillAgentsEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.state.systemState = systemState();
    vi.mocked(useSkill).mockReturnValue({
      data: existingSkill(),
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useEnabledSkills).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useUpdateSkillEnablement).mockReturnValue(idleMutation as never);
  });

  it("saves the selected subjects and returns to skill detail", async () => {
    const user = userEvent.setup();
    const updateMutation = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    };
    vi.mocked(useUpdateSkillEnablement).mockReturnValue(
      updateMutation as never,
    );
    mockSocket.state.systemState = systemState({
      connectedClientClusters: [
        {
          identityType: "consumerTag",
          consumerTag: "engineering",
          clientNames: [],
          sessionIds: [],
          usage: { callCount: 0 },
        },
      ],
    });

    renderEditorRoute();

    expect(screen.getByTestId("applied-agents")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Manage agents" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("checkbox", {
        name: "engineering, Consumer tag",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateMutation.mutateAsync).toHaveBeenCalled());
    expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
      skillId,
      previous: [],
      next: [{ kind: "consumerTag", value: "engineering" }],
    });
    expect(toast).toHaveBeenCalledWith({
      title: "Skill agents updated",
      description: "Skill access changes were saved.",
    });
    expect(await screen.findByText("Skill detail route")).toBeInTheDocument();
  });

  it("cancels back to skill detail without mutating", async () => {
    const user = userEvent.setup();
    renderEditorRoute();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Skill detail route")).toBeInTheDocument();
    expect(idleMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("keeps the editor open and dirty when saving fails", async () => {
    const user = userEvent.setup();
    const updateMutation = {
      mutateAsync: vi.fn().mockRejectedValue(new Error("Permission denied")),
      isPending: false,
    };
    vi.mocked(useUpdateSkillEnablement).mockReturnValue(
      updateMutation as never,
    );
    mockSocket.state.systemState = systemState({
      connectedClientClusters: [
        {
          identityType: "clientName",
          clientName: "cursor",
          sessionIds: [],
          usage: { callCount: 0 },
        },
      ],
    });

    renderEditorRoute();
    await user.click(
      screen.getByRole("checkbox", { name: "cursor, Client name" }),
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: "Failed to update skill agents",
        description: "Permission denied",
        variant: "destructive",
      });
    });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    expect(screen.getByText("Edit skill agents")).toBeInTheDocument();
  });

  it("renders standard loading and not-found states", () => {
    vi.mocked(useSkill).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as never);
    renderEditorRoute();
    expect(screen.getByText("Loading skill...")).toBeInTheDocument();

    cleanup();
    vi.mocked(useSkill).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as never);
    renderEditorRoute();
    expect(screen.getByText("Skill not found.")).toBeInTheDocument();
  });

  it("explains how to connect agents and links to the dashboard when none are available", async () => {
    const user = userEvent.setup();
    renderEditorRoute();

    expect(
      screen.getByText(
        "Connect AI agents from the dashboard to apply this skill.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Go to dashboard" }));

    expect(screen.getByText("Dashboard route")).toBeInTheDocument();
  });

  function renderEditorRoute() {
    const router = createMemoryRouter(
      [
        {
          path: "/skills/:id/agents",
          element: <SkillAgentsEditor />,
        },
        {
          path: "/skills/:id",
          element: <div>Skill detail route</div>,
        },
        {
          path: "/dashboard",
          element: <div>Dashboard route</div>,
        },
      ],
      { initialEntries: [`/skills/${skillId}/agents`] },
    );

    return render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  }
});

function existingSkill(): Skill {
  return {
    id: skillId,
    name: "existing",
    description: "Existing description",
    body: "# Existing",
    exposeAsPrompt: true,
    author: { setupOwnerId: "o", displayName: "Amir" },
    updatedAt: new Date("2026-07-07T00:00:00.000Z"),
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
