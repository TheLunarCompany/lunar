import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkillIdentity } from ".";

describe("SkillIdentity", () => {
  it("renders composed skill identity details", () => {
    render(
      <SkillIdentity.Root
        name="browser-automation-and-ui-testing"
        description="Drive a real browser to reproduce bugs."
        maintainerName="Lunar"
        updatedAt={new Date("2026-06-29T10:00:00.000Z")}
      >
        <SkillIdentity.Header>
          <SkillIdentity.Avatar />
          <SkillIdentity.Title />
        </SkillIdentity.Header>
        <SkillIdentity.Description />
        <SkillIdentity.Meta>
          <SkillIdentity.Maintainer />
          <SkillIdentity.UpdatedAt />
        </SkillIdentity.Meta>
      </SkillIdentity.Root>,
    );

    expect(
      screen.getByRole("heading", {
        name: "browser-automation-and-ui-testing",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("BR")).toBeInTheDocument();
    expect(
      screen.getByText("Drive a real browser to reproduce bugs."),
    ).toBeInTheDocument();
    expect(screen.getByText("Maintained by")).toBeInTheDocument();
    expect(screen.getByText("Lunar")).toBeInTheDocument();
    expect(screen.getByText(/^Updated/)).toBeInTheDocument();
  });

  it("renders caller-provided actions beside the skill title", () => {
    render(
      <SkillIdentity.Root
        name="remediate-dependabot-alerts"
        description="Fix dependency alerts."
        maintainerName="Lunar"
        updatedAt={new Date("2026-06-29T10:00:00.000Z")}
      >
        <SkillIdentity.Header>
          <SkillIdentity.Avatar />
          <SkillIdentity.Title />
          <SkillIdentity.Actions>
            <button type="button">Delete skill</button>
          </SkillIdentity.Actions>
        </SkillIdentity.Header>
      </SkillIdentity.Root>,
    );

    expect(
      screen.getByRole("button", { name: "Delete skill" }),
    ).toBeInTheDocument();
  });
});
