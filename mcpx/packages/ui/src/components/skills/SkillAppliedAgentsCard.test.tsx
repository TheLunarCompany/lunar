import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ScopeSubject } from "@mcpx/shared-model";
import { describe, expect, it, vi } from "vitest";
import type { SkillAgentOption } from "@/mapping/skill-agents";
import { SkillAppliedAgentsCard } from "./SkillAppliedAgentsCard";

const engineering: ScopeSubject = {
  kind: "consumerTag",
  value: "engineering",
};
const offline: ScopeSubject = {
  kind: "clientName",
  value: "legacy-client",
};

const options: SkillAgentOption[] = [
  {
    key: "consumerTag:engineering",
    subject: engineering,
    label: "Engineering",
    connected: true,
  },
  {
    key: "clientName:legacy-client",
    subject: offline,
    label: "Legacy client",
    connected: false,
  },
];

describe("SkillAppliedAgentsCard", () => {
  it("renders the sidebar card read-only and navigates through Manage agents", async () => {
    const user = userEvent.setup();
    const onManageAgents = vi.fn();

    render(
      <SkillAppliedAgentsCard
        options={options}
        appliedSubjects={[engineering, offline]}
        onManageAgents={onManageAgents}
      />,
    );

    expect(screen.getByTestId("applied-agents")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Applied to agents" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("Legacy client")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Engineering logo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Legacy client logo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Not currently connected")).toBeInTheDocument();
    expect(
      screen.queryByTestId("applied-agent-remove"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /remove/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Manage agents" }));
    expect(onManageAgents).toHaveBeenCalledOnce();
  });

  it("shows loading, error, and empty states without losing Manage agents", () => {
    const onManageAgents = vi.fn();

    const { rerender } = render(
      <SkillAppliedAgentsCard
        options={[]}
        appliedSubjects={[]}
        onManageAgents={onManageAgents}
        loading
      />,
    );
    expect(screen.getByText("Loading agents…")).toBeInTheDocument();

    rerender(
      <SkillAppliedAgentsCard
        options={[]}
        appliedSubjects={[]}
        onManageAgents={onManageAgents}
        error
      />,
    );
    expect(screen.getByText("Unable to load agents.")).toBeInTheDocument();

    rerender(
      <SkillAppliedAgentsCard
        options={[]}
        appliedSubjects={[]}
        onManageAgents={onManageAgents}
      />,
    );
    expect(
      screen.getByText("No agents have this skill applied."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Manage agents" }),
    ).toBeInTheDocument();
  });

  it("omits Manage agents when rendered inside the editor", () => {
    render(
      <SkillAppliedAgentsCard
        options={[options[0]]}
        appliedSubjects={[engineering]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Manage agents" }),
    ).not.toBeInTheDocument();
  });
});
