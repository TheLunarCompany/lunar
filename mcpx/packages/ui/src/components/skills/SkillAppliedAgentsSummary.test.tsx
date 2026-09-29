import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ScopeSubject } from "@mcpx/shared-model";
import { describe, expect, it, vi } from "vitest";
import type { SkillAgentOption } from "@/mapping/skill-agents";
import { SkillAppliedAgentsSummary } from "./SkillAppliedAgentsSummary";

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

describe("SkillAppliedAgentsSummary", () => {
  it("renders applied subjects read-only and navigates through Edit", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <SkillAppliedAgentsSummary
        options={options}
        appliedSubjects={[engineering, offline]}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("Legacy client")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Engineering logo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Legacy client logo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Not currently connected")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("shows loading, error, and empty states with Edit available", () => {
    const onEdit = vi.fn();

    const { rerender } = render(
      <SkillAppliedAgentsSummary
        options={[]}
        appliedSubjects={[]}
        onEdit={onEdit}
        loading
      />,
    );
    expect(screen.getByText("Loading agents…")).toBeInTheDocument();

    rerender(
      <SkillAppliedAgentsSummary
        options={[]}
        appliedSubjects={[]}
        onEdit={onEdit}
        error
      />,
    );
    expect(screen.getByText("Unable to load agents.")).toBeInTheDocument();

    rerender(
      <SkillAppliedAgentsSummary
        options={[]}
        appliedSubjects={[]}
        onEdit={onEdit}
      />,
    );
    expect(
      screen.getByText("No agents have this skill applied."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });
});
