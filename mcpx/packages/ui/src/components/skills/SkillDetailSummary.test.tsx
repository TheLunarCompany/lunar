import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkillDetailSummary } from "./SkillDetailSummary";

describe("SkillDetailSummary", () => {
  it("renders skill description and metadata", () => {
    render(
      <SkillDetailSummary
        name="browser-automation-and-ui-testing"
        description="Drive a real browser to reproduce bugs."
        maintainerName="Lunar"
        updatedAt={new Date("2026-06-29T10:00:00.000Z")}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "browser-automation-and-ui-testing",
        level: 2,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Drive a real browser to reproduce bugs."),
    ).toBeInTheDocument();
    expect(screen.getByText("Maintained by")).toBeInTheDocument();
    expect(screen.getByText("Lunar")).toBeInTheDocument();
    expect(screen.getByText(/^Updated/)).toBeInTheDocument();
  });
});
