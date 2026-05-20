import { fireEvent, render, screen } from "@testing-library/react";
import { Position } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import CustomCurvedEdge from "./CustomCurvedEdge";
import { AddButtonActionsProvider } from "./add-button-actions";

vi.mock("@xyflow/react", async () => {
  const actual =
    await vi.importActual<typeof import("@xyflow/react")>("@xyflow/react");

  return {
    ...actual,
    EdgeLabelRenderer: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

describe("CustomCurvedEdge", () => {
  it("routes agent edges through the shared junction before entering MCPX", () => {
    const { container } = render(
      <svg>
        <CustomCurvedEdge
          id="e-agent-7"
          sourceX={-200}
          sourceY={54}
          targetX={-70}
          targetY={0}
          source="agent-7"
          target="mcpx"
          sourcePosition={Position.Right}
          targetPosition={Position.Left}
          data={{
            column: 0,
            nodesInColumn: 6,
            junctionX: -116,
            prevColumnLeftEdgeX: 0,
          }}
        />
      </svg>,
    );

    const basePath = container.querySelector("path");
    expect(basePath).toBeInstanceOf(SVGPathElement);
    if (!(basePath instanceof SVGPathElement)) {
      throw new Error("Expected base path to render");
    }
    expect(basePath.getAttribute("d")).toContain(" -116,0 L -70,0");
  });

  it("keeps outer agent columns clear by joining the corridor before the prior column", () => {
    const { container } = render(
      <svg>
        <CustomCurvedEdge
          id="e-agent-13"
          sourceX={-520}
          sourceY={-66}
          targetX={-70}
          targetY={0}
          source="agent-13"
          target="mcpx"
          sourcePosition={Position.Right}
          targetPosition={Position.Left}
          data={{
            column: 2,
            nodesInColumn: 6,
            junctionX: -116,
            prevColumnLeftEdgeX: -240,
          }}
        />
      </svg>,
    );

    const basePath = container.querySelector("path");
    expect(basePath).toBeInstanceOf(SVGPathElement);
    if (!(basePath instanceof SVGPathElement)) {
      throw new Error("Expected base path to render");
    }
    expect(basePath.getAttribute("d")).toContain(" -270,0 L -70,0");
  });

  it("renders an interactive add-agent label at the shared junction", () => {
    const onAddAgent = vi.fn();

    render(
      <AddButtonActionsProvider value={{ onAddAgent }}>
        <CustomCurvedEdge
          id="e-agent-7"
          sourceX={-200}
          sourceY={54}
          targetX={-70}
          targetY={0}
          source="agent-7"
          target="mcpx"
          sourcePosition={Position.Right}
          targetPosition={Position.Left}
          data={{
            addButtonKind: "agent",
            column: 0,
            nodesInColumn: 6,
            junctionX: -116,
            prevColumnLeftEdgeX: 0,
          }}
        />
      </AddButtonActionsProvider>,
    );

    const button = screen.getByRole("button", { name: "Add Agent" });
    expect(button.style.transform).toBe(
      "translate(-50%, -50%) translate(-116px, 0px)",
    );

    fireEvent.click(button);

    expect(onAddAgent).toHaveBeenCalledTimes(1);
  });
});
