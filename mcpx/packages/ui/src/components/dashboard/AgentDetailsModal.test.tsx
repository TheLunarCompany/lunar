import type { ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSkillsFeatureEnabled } from "@/data/skills";
import type { Agent } from "../../types/agent";

import { AgentDetailsModal } from "./AgentDetailsModal";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  generatePath: (path: string, params: { id: string }) =>
    path.replace(":id", params.id),
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/hooks/useAgentSkillAssignments", () => ({
  useAgentSkillAssignments: vi.fn(),
}));

vi.mock("@/store", () => ({
  socketStore: {
    getState: () => ({
      systemState: {
        connectedClients: [
          {
            sessionId: "session-1",
            consumerTag: "agent-consumer",
            clientInfo: { name: "agent-consumer" },
          },
        ],
        targetServers: [
          {
            name: "GitHub",
            icon: "",
            catalogItemId: "catalog-1",
            tools: ["list_issues"],
            prompts: [],
          },
        ],
      },
      appConfig: {
        permissions: {
          consumers: {},
        },
        targetServerAttributes: {},
      },
    }),
  },
  useAccessControlsStore: (
    selector: (state: {
      toolGroups: unknown[];
      profiles: unknown[];
      setProfiles: () => void;
    }) => unknown,
  ) =>
    selector({
      toolGroups: [
        {
          id: "group-1",
          name: "Version control & issue management",
          description: "Open new pull request",
          services: {
            GitHub: ["create_pull_request", "list_issues"],
          },
        },
      ],
      profiles: [],
      setProfiles: vi.fn(),
    }),
  useSocketStore: (
    selector: (state: { systemState: unknown; appConfig: unknown }) => unknown,
  ) =>
    selector({
      systemState: {
        connectedClients: [
          {
            sessionId: "session-1",
            consumerTag: "agent-consumer",
            clientInfo: { name: "agent-consumer" },
          },
        ],
        targetServers: [
          {
            name: "GitHub",
            icon: "",
            catalogItemId: "catalog-1",
            tools: ["list_issues"],
            prompts: [],
          },
        ],
      },
      appConfig: {
        permissions: {
          consumers: {},
        },
        targetServerAttributes: {},
      },
    }),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SheetHeader: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/SessionIdsTooltip", () => ({
  SessionIdsTooltip: () => <div>session-1</div>,
}));

vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: () => null,
}));

vi.mock("@/data/skills", () => ({
  useSkillsFeatureEnabled: vi.fn(() => ({ data: true })),
}));

vi.mock("@/lib/api", () => ({
  apiClient: {},
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: vi.fn(),
}));

const agent: Agent = {
  id: "agent-1",
  identifier: "agent-consumer",
  sessionIds: ["session-1"],
  status: "CONNECTED",
  usage: { callCount: 0 },
  dynamicMode: false,
  visibleTools: [],
  connectionState: "connected",
  identityType: "consumerTag",
  consumerTag: "agent-consumer",
  clientNames: ["agent-consumer"],
};

const assignedSkill = {
  id: "0190a000-0000-7000-8000-000000000001",
  name: "Review Pull Requests",
  description: "Review repository changes.",
  body: "# Review Pull Requests",
  exposeAsPrompt: true,
  author: { setupOwnerId: "owner-1", displayName: "Owner" },
  updatedAt: new Date("2026-07-14T00:00:00.000Z"),
  publishedAt: null,
  capabilityGroup: {
    items: [
      { catalogItemId: "catalog-1", tools: ["list_issues"], prompts: [] },
    ],
  },
};

const unassignedSkill = {
  ...assignedSkill,
  id: "0190a000-0000-7000-8000-000000000002",
  name: "Debug Incidents",
  description: "Investigate production incidents.",
};

function mockAgentSkillAssignments() {
  vi.mocked(useAgentSkillAssignments).mockReturnValue(
    agentSkillAssignmentsResult(),
  );
}

function agentSkillAssignmentsResult(overrides: Record<string, unknown> = {}) {
  return {
    skills: [assignedSkill, unassignedSkill].map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      href: `/skills/${skill.id}`,
      providers: [{ name: "GitHub", isMissingOrInactive: false }],
      toolsCount: 1,
      promptsCount: 0,
    })),
    selectedSkillIds: new Set([assignedSkill.id]),
    isDirty: false,
    isLoading: false,
    isError: false,
    isSaving: false,
    isInitialized: true,
    toggleSkill: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.mocked(useSkillsFeatureEnabled).mockReturnValue({ data: true });
  mockAgentDrawerSkillsData();
});

describe("AgentDetailsModal", () => {
  it("provides an accessible close control", () => {
    render(<AgentDetailsModal agent={agent} isOpen onClose={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Close agent details" }),
    ).toBeInTheDocument();
  });

  it("shows a Connected status badge for a connected agent", () => {
    render(<AgentDetailsModal agent={agent} isOpen onClose={vi.fn()} />);

    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("shows a Disconnected status badge for a disconnected agent", () => {
    render(
      <AgentDetailsModal
        agent={{ ...agent, connectionState: "disconnected" }}
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Disconnected")).toBeInTheDocument();
    expect(screen.queryByText("Connected")).toBeNull();
  });

  it("shows an Unresponsive status badge for an unresponsive agent", () => {
    render(
      <AgentDetailsModal
        agent={{ ...agent, connectionState: "unresponsive" }}
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Unresponsive")).toBeInTheDocument();
  });

  it("renders all skills with their assignment state", () => {
    render(<AgentDetailsModal agent={agent} isOpen onClose={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Tools Access" }),
    ).toBeInTheDocument();
    expect(screen.getByText("All Server Tools (1)")).toBeInTheDocument();
    expect(screen.getByText("Review repository changes.")).toBeInTheDocument();
    expect(
      screen.getByText("Investigate production incidents."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("GitHub")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: /Review Pull Requests/ }),
    ).toHaveAttribute("href", "/skills/0190a000-0000-7000-8000-000000000001");
    expect(
      screen.getByRole("switch", { name: "Use Review Pull Requests" }),
    ).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Use Debug Incidents" }),
    ).not.toBeChecked();
    expect(
      screen.queryByText("Version control & issue management"),
    ).not.toBeInTheDocument();
  });

  it("saves changed skill assignments for the agent", async () => {
    const toggleSkill = vi.fn();
    const save = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAgentSkillAssignments).mockReturnValue(
      agentSkillAssignmentsResult({
        isDirty: true,
        toggleSkill,
        save,
      }),
    );

    render(<AgentDetailsModal agent={agent} isOpen onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("switch", { name: "Use Debug Incidents" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toggleSkill).toHaveBeenCalledWith(unassignedSkill.id, true);
      expect(save).toHaveBeenCalledTimes(1);
    });
  });

  it("does not render or fetch skills when the Skills feature flag is disabled", () => {
    vi.mocked(useSkillsFeatureEnabled).mockReturnValue({ data: false });

    render(<AgentDetailsModal agent={agent} isOpen onClose={vi.fn()} />);

    expect(screen.queryByRole("heading", { name: /Skills/ })).toBeNull();
    expect(useAgentSkillAssignments).toHaveBeenCalledWith(
      expect.objectContaining({ agent, enabled: false }),
    );
    expect(screen.getByText("Tools Access")).toBeInTheDocument();
  });

  it("uses an accessible icon-only caret button for tool group expansion", () => {
    vi.mocked(useSkillsFeatureEnabled).mockReturnValue({ data: false });
    render(<AgentDetailsModal agent={agent} isOpen onClose={vi.fn()} />);

    const expandButton = screen.getByRole("button", {
      name: "Expand tool group",
    });
    expect(expandButton).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByText("Version control & issue management"),
    ).toBeInTheDocument();
    expect(screen.queryByText("View More")).toBeNull();
    expect(screen.queryByText("View Less")).toBeNull();
  });

  it("toggles tool group expansion when clicking the card content", () => {
    vi.mocked(useSkillsFeatureEnabled).mockReturnValue({ data: false });
    render(<AgentDetailsModal agent={agent} isOpen onClose={vi.fn()} />);

    expect(screen.queryByText("create_pull_request")).toBeNull();

    act(() => {
      fireEvent.click(screen.getByText("Version control & issue management"));
    });

    expect(screen.getByText("create_pull_request")).toBeTruthy();

    act(() => {
      fireEvent.click(screen.getByText("2 tools"));
    });

    expect(screen.queryByText("create_pull_request")).toBeNull();
  });
});
