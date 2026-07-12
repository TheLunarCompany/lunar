import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { Skill } from "@mcpx/shared-model";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Skills from "./Skills";
import { useGetMCPServers } from "@/data/catalog-servers";
import { useDeleteSkill, useSkills } from "@/data/skills";

vi.mock("@/data/skills", () => ({
  useSkills: vi.fn(),
  useDeleteSkill: vi.fn(),
}));
vi.mock("@/data/catalog-servers", () => ({
  useGetMCPServers: vi.fn(),
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

function renderPage() {
  return render(
    <NuqsTestingAdapter>
      <MemoryRouter>
        <Skills />
      </MemoryRouter>
    </NuqsTestingAdapter>,
  );
}

describe("Skills page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDeleteSkill).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
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
});
