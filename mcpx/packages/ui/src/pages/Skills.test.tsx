import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Skill } from "@mcpx/shared-model";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Skills from "./Skills";
import { useGetMCPServers } from "@/data/catalog-servers";
import { useDeleteSkill, useEnabledSkills, useSkills } from "@/data/skills";
import { socketStore } from "@/store";

vi.mock("@/data/skills", () => ({
  useSkills: vi.fn(),
  useEnabledSkills: vi.fn(),
  useDeleteSkill: vi.fn(),
}));
vi.mock("@/data/catalog-servers", () => ({
  useGetMCPServers: vi.fn(),
}));
vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: (name: string) => `/icons/${name}.svg`,
}));
vi.mock("@/components/ui/use-toast", () => ({ toast: vi.fn() }));

const skills: Skill[] = [
  {
    id: "0190a000-0000-7000-8000-000000000001",
    name: "review-pull-requests",
    description: "Review repository changes.",
    body: "# Review",
    exposeAsPrompt: true,
    author: { setupOwnerId: "o", displayName: "Amir" },
    updatedAt: new Date("2026-06-29T10:00:00.000Z"),
  },
];

const sortableSkills: Skill[] = [
  {
    ...skills[0],
    id: "0190a000-0000-7000-8000-000000000001",
    name: "z-last-alpha",
    updatedAt: new Date("2026-06-29T10:00:00.000Z"),
  },
  {
    ...skills[0],
    id: "0190a000-0000-7000-8000-000000000002",
    name: "a-first-alpha",
    updatedAt: new Date("2026-07-01T10:00:00.000Z"),
  },
  {
    ...skills[0],
    id: "0190a000-0000-7000-8000-000000000003",
    name: "middle-alpha",
    updatedAt: new Date("2026-06-30T10:00:00.000Z"),
  },
];

const filterableSkills: Skill[] = [
  {
    ...skills[0],
    id: "0190a000-0000-7000-8000-000000000011",
    name: "engineering-slack",
    capabilityGroup: {
      items: [{ catalogItemId: "server-slack", tools: [], prompts: [] }],
    },
  },
  {
    ...skills[0],
    id: "0190a000-0000-7000-8000-000000000012",
    name: "cursor-slack",
    capabilityGroup: {
      items: [{ catalogItemId: "server-slack", tools: [], prompts: [] }],
    },
  },
  {
    ...skills[0],
    id: "0190a000-0000-7000-8000-000000000013",
    name: "engineering-github",
    capabilityGroup: {
      items: [{ catalogItemId: "server-github", tools: [], prompts: [] }],
    },
  },
];

const filterSystemState = {
  targetServers: [
    { name: "Slack", catalogItemId: "server-slack", tools: [], prompts: [] },
    {
      name: "GitHub",
      catalogItemId: "server-github",
      tools: [],
      prompts: [],
    },
  ],
  connectedClientClusters: [
    {
      identityType: "consumerTag",
      consumerTag: "Engineering",
      clientNames: [],
      sessionIds: [],
      usage: { callCount: 0 },
    },
    {
      identityType: "consumerTag",
      consumerTag: "Cursor",
      clientNames: [],
      sessionIds: [],
      usage: { callCount: 0 },
    },
  ],
};

const filterEnabledSkills = [
  {
    subject: { kind: "consumerTag", value: "Engineering" },
    skillIds: [filterableSkills[0].id, filterableSkills[2].id],
  },
  {
    subject: { kind: "consumerTag", value: "Cursor" },
    skillIds: [filterableSkills[1].id],
  },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter>
        <MemoryRouter>
          <Skills />
        </MemoryRouter>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

describe("Skills page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketStore.setState({ systemState: null });
    vi.mocked(useDeleteSkill).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useEnabledSkills).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useGetMCPServers).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
  });

  it("renders skill cards when loaded", () => {
    vi.mocked(useSkills).mockReturnValue({
      data: skills,
      isLoading: false,
      isError: false,
    } as never);
    const { container } = renderPage();
    expect(
      container.querySelector('[data-slot="skill-page-root"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        '[data-slot="skill-page-container"][data-size="full"]',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("review-pull-requests")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create skill" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Type" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tools" }),
    ).not.toBeInTheDocument();
  });

  it("renders the page header", () => {
    vi.mocked(useSkills).mockReturnValue({
      data: skills,
      isLoading: false,
      isError: false,
    } as never);

    renderPage();

    expect(
      screen.getByRole("heading", { name: "Skills", level: 1 }),
    ).toBeInTheDocument();
  });

  it("shows the empty state when there are no skills", () => {
    vi.mocked(useSkills).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    renderPage();
    expect(screen.getByText("No skills yet")).toBeInTheDocument();
  });

  it("sorts by updated date ascending by default", () => {
    vi.mocked(useSkills).mockReturnValue({
      data: sortableSkills,
      isLoading: false,
      isError: false,
    } as never);

    renderPage();

    expect(
      screen
        .getAllByRole("article")
        .map((card) => within(card).getByRole("heading").textContent),
    ).toEqual(["z-last-alpha", "middle-alpha", "a-first-alpha"]);
  });

  it("offers alphabetical and updated date sort options", async () => {
    const user = userEvent.setup();
    vi.mocked(useSkills).mockReturnValue({
      data: sortableSkills,
      isLoading: false,
      isError: false,
    } as never);

    renderPage();

    await user.click(screen.getByRole("button", { name: "Sort" }));

    expect(
      screen.getByRole("menuitemcheckbox", { name: "A to Z" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Z to A" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Oldest updated" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Newest updated" }),
    ).toBeInTheDocument();
  });

  it("filters by multiple agents with OR semantics and servers with AND semantics", async () => {
    const user = userEvent.setup();
    socketStore.setState({ systemState: filterSystemState as never });
    vi.mocked(useSkills).mockReturnValue({
      data: filterableSkills,
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useEnabledSkills).mockReturnValue({
      data: filterEnabledSkills,
      isLoading: false,
      isError: false,
    } as never);

    renderPage();

    expect(
      screen.getByRole("button", { name: "Filter by agents" }),
    ).not.toHaveClass("bg-background");
    await user.click(screen.getByRole("button", { name: "Filter by agents" }));
    await user.click(
      screen.getByRole("menuitemcheckbox", {
        name: "Engineering logo Engineering",
      }),
    );
    expect(
      within(
        screen.getByRole("menuitemcheckbox", {
          name: "Engineering logo Engineering",
        }),
      ).getByRole("img", { name: "Engineering logo" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "Cursor logo Cursor" }),
    );

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(3));
    expect(
      screen.getByRole("button", { name: "Filter by MCP servers" }),
    ).not.toHaveClass("bg-background");
    await user.click(
      screen.getByRole("button", { name: "Filter by MCP servers" }),
    );
    const slackOption = screen.getByRole("menuitemcheckbox", {
      name: "Slack",
    });
    expect(slackOption.querySelector("img")).toHaveAttribute(
      "src",
      "/icons/Slack.svg",
    );
    await user.click(slackOption);
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(
        screen
          .getAllByRole("article")
          .map((card) => within(card).getByRole("heading").textContent),
      ).toEqual(["cursor-slack", "engineering-slack"]),
    );

    await user.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(3));
  });
});
