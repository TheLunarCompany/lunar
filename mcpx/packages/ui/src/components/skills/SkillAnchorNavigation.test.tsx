import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkillAnchorNavigation } from "./SkillAnchorNavigation";

describe("SkillAnchorNavigation", () => {
  it("renders section anchor links", () => {
    render(
      <SkillAnchorNavigation
        items={[
          { href: "#skill-instructions", label: "SKILL.md", icon: "file" },
          {
            href: "#linked-mcp-capabilities",
            label: "Linked MCP",
            icon: "capabilities",
          },
        ]}
      />,
    );

    expect(screen.getByText("On this page")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SKILL.md" })).toHaveAttribute(
      "href",
      "#skill-instructions",
    );
    expect(screen.getByRole("link", { name: "Linked MCP" })).toHaveAttribute(
      "href",
      "#linked-mcp-capabilities",
    );
    expect(
      screen.queryByRole("link", { name: "Applied to agents" }),
    ).not.toBeInTheDocument();
  });
});
