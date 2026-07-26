import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentSkillsSection } from "./AgentSkillsSection";

vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: () => null,
}));

const skills = [
  {
    id: "skill-1",
    name: "Code Review",
    description: "Review pull requests.",
    href: "/skills/skill-1",
    providers: [
      { name: "Context7" },
      { name: "GitHub", isMissingOrInactive: true },
    ],
  },
  {
    id: "skill-2",
    name: "Debugging",
    description: "Trace issues across the stack.",
    href: "/skills/skill-2",
    providers: [],
  },
];

describe("AgentSkillsSection", () => {
  it("renders assigned skills as links to their detail pages", () => {
    render(
      <MemoryRouter>
        <AgentSkillsSection skills={skills} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Skills (2)" })).toBeVisible();
    expect(screen.getByText("Review pull requests.")).toBeVisible();
    expect(screen.getByRole("link", { name: /Code Review/ })).toHaveAttribute(
      "href",
      "/skills/skill-1",
    );
    expect(screen.getByRole("link", { name: /Debugging/ })).toHaveAttribute(
      "href",
      "/skills/skill-2",
    );
    expect(screen.getByText("Context7")).toBeVisible();
    expect(screen.getByText("GitHub")).toBeVisible();
    expect(screen.queryByText("2 tools")).not.toBeInTheDocument();
  });

  it("renders loading, error, and empty states", () => {
    const { rerender } = render(<AgentSkillsSection skills={[]} loading />);
    expect(screen.getByText("Loading skills…")).toBeVisible();

    rerender(<AgentSkillsSection skills={[]} error />);
    expect(screen.getByText("Unable to load skills.")).toBeVisible();

    rerender(<AgentSkillsSection skills={[]} />);
    expect(screen.getByText("No skills assigned.")).toBeVisible();
  });
});
