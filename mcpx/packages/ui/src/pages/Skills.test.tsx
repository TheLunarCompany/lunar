import { render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { Skill } from "@mcpx/shared-model";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Skills from "./Skills";
import { useDeleteSkill, useSkills } from "@/data/skills";

vi.mock("@/data/skills", () => ({
  useSkills: vi.fn(),
  useDeleteSkill: vi.fn(),
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

  it("shows the empty state when there are no skills", () => {
    vi.mocked(useSkills).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    renderPage();
    expect(screen.getByText("No skills yet")).toBeInTheDocument();
  });
});
