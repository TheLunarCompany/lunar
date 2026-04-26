import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NodeBadge } from "./node-badge";

describe("NodeBadge", () => {
  it("keeps badge width content-sized inside flex columns", () => {
    render(
      <div className="flex flex-col">
        <NodeBadge variant="disabled">Disabled</NodeBadge>
      </div>,
    );

    expect(screen.getByText("Disabled").className).toContain("w-fit");
  });
});
