import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
      { name: "Context7", isMissingOrInactive: false },
      { name: "GitHub", isMissingOrInactive: true },
    ],
    toolsCount: 2,
    promptsCount: 1,
  },
  {
    id: "skill-2",
    name: "Debugging",
    description: "Trace issues across the stack.",
    href: "/skills/skill-2",
    providers: [],
    toolsCount: 0,
    promptsCount: 0,
  },
];

describe("AgentSkillsSection", () => {
  it("renders all skills with controlled assignment toggles", () => {
    const onSkillToggle = vi.fn();
    render(
      <MemoryRouter>
        <AgentSkillsSection
          skills={skills}
          totalToolsCount={5}
          selectedSkillIds={new Set(["skill-1"])}
          onSkillToggle={onSkillToggle}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Tools Access" })).toBeVisible();
    expect(screen.getByText("All Server Tools (5)")).toBeVisible();
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
    expect(screen.getByText("2 tools · 1 prompt")).toBeVisible();

    expect(
      screen.getByRole("switch", { name: "Use Code Review" }),
    ).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Use Debugging" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Use all server tools" }),
    ).not.toBeChecked();
    fireEvent.click(screen.getByRole("switch", { name: "Use Debugging" }));
    expect(onSkillToggle).toHaveBeenCalledWith("skill-2", true);
  });

  it("clears all skill selections when full access is turned on", () => {
    const onSkillToggle = vi.fn();
    render(
      <MemoryRouter>
        <AgentSkillsSection
          skills={skills}
          totalToolsCount={5}
          selectedSkillIds={new Set(["skill-1", "missing-skill"])}
          onSkillToggle={onSkillToggle}
        />
      </MemoryRouter>,
    );

    const fullAccessToggle = screen.getByRole("switch", {
      name: "Use all server tools",
    });
    expect(fullAccessToggle).not.toBeChecked();

    fireEvent.click(fullAccessToggle);
    expect(onSkillToggle).toHaveBeenCalledTimes(2);
    expect(onSkillToggle).toHaveBeenCalledWith("skill-1", false);
    expect(onSkillToggle).toHaveBeenCalledWith("missing-skill", false);
  });

  it("enables only the first skill when full access is turned off", () => {
    const onSkillToggle = vi.fn();
    render(
      <MemoryRouter>
        <AgentSkillsSection
          skills={skills}
          totalToolsCount={5}
          selectedSkillIds={new Set()}
          onSkillToggle={onSkillToggle}
        />
      </MemoryRouter>,
    );

    const fullAccessToggle = screen.getByRole("switch", {
      name: "Use all server tools",
    });
    expect(fullAccessToggle).toBeChecked();

    fireEvent.click(fullAccessToggle);
    expect(onSkillToggle).toHaveBeenCalledOnce();
    expect(onSkillToggle).toHaveBeenCalledWith("skill-1", true);
  });

  it("filters skills using the same search pattern as tools", () => {
    render(
      <MemoryRouter>
        <AgentSkillsSection
          skills={skills}
          totalToolsCount={5}
          selectedSkillIds={new Set()}
          onSkillToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("Search"), {
      target: { value: "github" },
    });
    expect(screen.getByText("Code Review")).toBeVisible();
    expect(screen.queryByText("Debugging")).not.toBeInTheDocument();
  });

  it("renders loading, error, and empty states", () => {
    const props = {
      skills: [],
      totalToolsCount: 0,
      selectedSkillIds: new Set<string>(),
      onSkillToggle: vi.fn(),
    };
    const { rerender } = render(<AgentSkillsSection {...props} loading />);
    expect(screen.getByText("Loading skills…")).toBeVisible();

    rerender(<AgentSkillsSection {...props} error />);
    expect(screen.getByText("Unable to load skills.")).toBeVisible();

    rerender(<AgentSkillsSection {...props} />);
    expect(screen.getByText("No skills available.")).toBeVisible();
  });

  it("disables the full access toggle when there are no skills to fall back to", () => {
    render(
      <MemoryRouter>
        <AgentSkillsSection
          skills={[]}
          totalToolsCount={5}
          selectedSkillIds={new Set()}
          onSkillToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("switch", { name: "Use all server tools" }),
    ).toBeDisabled();
  });
});
