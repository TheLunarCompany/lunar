import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NodeBadge } from "./node-badge";

describe("NodeBadge", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with the node-badge slot and default variant metadata", () => {
    render(<NodeBadge>Claude</NodeBadge>);

    const badge = screen.getByText("Claude");

    expect(badge).toHaveAttribute("data-slot", "node-badge");
    expect(badge).toHaveAttribute("data-variant", "default");
  });

  it("keeps node-specific variant names", () => {
    render(<NodeBadge variant="disabled">Disabled</NodeBadge>);

    const badge = screen.getByText("Disabled");

    expect(badge).toHaveAttribute("data-variant", "disabled");
  });

  it("keeps badge width content-sized inside flex columns", () => {
    render(
      <div className="flex flex-col">
        <NodeBadge variant="disabled">Disabled</NodeBadge>
      </div>,
    );

    expect(screen.getByText("Disabled").className).toContain("w-fit");
  });
});
