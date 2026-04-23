import { render } from "@testing-library/react";
import { Position } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import CustomCurvedEdge from "./CustomCurvedEdge";

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

    const [basePath] = container.querySelectorAll("path");
    expect(basePath).not.toBeNull();
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

    const [basePath] = container.querySelectorAll("path");
    expect(basePath).not.toBeNull();
    expect(basePath.getAttribute("d")).toContain(" -270,0 L -70,0");
  });
});
