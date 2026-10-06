import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkillSetupSummary } from "./SkillSetupSummary";

describe("SkillSetupSummary", () => {
  it("composes cards with caller-provided content and actions", () => {
    render(
      <SkillSetupSummary.Root>
        <SkillSetupSummary.Card>
          <SkillSetupSummary.Icon>
            <span aria-hidden="true">complete icon</span>
          </SkillSetupSummary.Icon>
          <SkillSetupSummary.Content>
            <SkillSetupSummary.Title>Instructions</SkillSetupSummary.Title>
            <SkillSetupSummary.Description>
              Added · SKILL.md
            </SkillSetupSummary.Description>
          </SkillSetupSummary.Content>
          <SkillSetupSummary.Action>
            <button type="button">Edit</button>
          </SkillSetupSummary.Action>
        </SkillSetupSummary.Card>
        <SkillSetupSummary.Card>
          <SkillSetupSummary.Icon>
            <span aria-hidden="true">optional icon</span>
          </SkillSetupSummary.Icon>
          <SkillSetupSummary.Content>
            <SkillSetupSummary.Title>MCP capabilities</SkillSetupSummary.Title>
            <SkillSetupSummary.Description>
              optional for some skills
            </SkillSetupSummary.Description>
          </SkillSetupSummary.Content>
          <SkillSetupSummary.Action>
            <button type="button">Add</button>
          </SkillSetupSummary.Action>
        </SkillSetupSummary.Card>
        <SkillSetupSummary.Card>
          <SkillSetupSummary.Icon>
            <span aria-hidden="true">required icon</span>
          </SkillSetupSummary.Icon>
          <SkillSetupSummary.Content>
            <SkillSetupSummary.Title>Applied to agents</SkillSetupSummary.Title>
            <SkillSetupSummary.Description>
              Required to run
            </SkillSetupSummary.Description>
          </SkillSetupSummary.Content>
          <SkillSetupSummary.Action>
            <button type="button">Apply</button>
          </SkillSetupSummary.Action>
        </SkillSetupSummary.Card>
      </SkillSetupSummary.Root>,
    );

    expect(
      screen.getByRole("region", { name: "Skill setup" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Instructions")).toBeInTheDocument();
    expect(screen.getByText("optional for some skills")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
  });
});
