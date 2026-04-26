import React from "react";
import { EdgeLabelRenderer, EdgeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAddButtonActions } from "./add-button-actions";

type AddButtonKind = "agent" | "server";

const ADD_BUTTON_SERVER_OFFSET = 46;

const CustomCurvedEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  data,
}) => {
  const { onAddAgent, onAddServer } = useAddButtonActions();
  const isAgentToMcpx = id
    ? id.startsWith("e-") && !id.startsWith("e-mcpx-")
    : false;

  let pathData: string;
  let addButtonLabelPosition: { x: number; y: number } | null = null;

  if (isAgentToMcpx) {
    // Agent → MCPX: curve each agent into the center corridor, then use a
    // shared trunk through the add-agent junction into the hub.
    const column = typeof data?.column === "number" ? data.column : 0;
    const nodesInColumn =
      typeof data?.nodesInColumn === "number" ? data.nodesInColumn : 1;
    const junctionX =
      typeof data?.junctionX === "number"
        ? data.junctionX
        : sourceX + (targetX - sourceX) * 0.6;
    const prevColumnLeftEdgeX =
      typeof data?.prevColumnLeftEdgeX === "number"
        ? data.prevColumnLeftEdgeX
        : 0;

    const connectionX = column === 0 ? junctionX : prevColumnLeftEdgeX - 30;
    if (data?.addButtonKind === "agent") {
      addButtonLabelPosition = { x: junctionX, y: targetY };
    }

    if (nodesInColumn <= 1 && Math.abs(targetY - sourceY) < 5 && column === 0) {
      pathData =
        `M ${sourceX},${sourceY}` +
        ` L ${junctionX},${sourceY}` +
        ` L ${targetX},${targetY}`;
    } else {
      const curveDx = Math.abs(connectionX - sourceX);
      const curveDy = Math.abs(targetY - sourceY);
      const curveDist = Math.sqrt(curveDx * curveDx + curveDy * curveDy);
      const curveOffset = Math.min(curveDist * 0.3, 40);

      pathData =
        `M ${sourceX},${sourceY}` +
        ` C ${sourceX + curveOffset},${sourceY} ${connectionX - curveOffset},${targetY} ${connectionX},${targetY}` +
        ` L ${targetX},${targetY}`;
    }
  } else {
    // MCPX → Server: trunk + branch approach
    //
    // Path layout:
    //   MCPX ───horizontal trunk───► connection point ─╮ bezier to target
    //
    // The connection point X is computed dynamically:
    //   - 40% of the way from source to target for column 0
    //   - 30% for column 1+ (closer to source to clear column 0 nodes)
    // This keeps the horizontal trunk clear of all nodes, and only the
    // final bezier branch reaches out to each individual target.
    const column = typeof data?.column === "number" ? data.column : 0;
    const nodesInColumn =
      typeof data?.nodesInColumn === "number" ? data.nodesInColumn : 1;
    const prevColumnRightEdgeX =
      typeof data?.prevColumnRightEdgeX === "number"
        ? data.prevColumnRightEdgeX
        : 0;

    const totalDx = targetX - sourceX;

    // Connection point X: where the horizontal trunk splits into a branch.
    // Column 0: split at 40% of the source→target distance.
    // Column 1+: split 30px past the right edge of the previous column,
    //            so the trunk clears all prior columns before branching.
    const connectionX =
      column === 0 ? sourceX + totalDx * 0.4 : prevColumnRightEdgeX + 30;
    if (data?.addButtonKind === "server") {
      addButtonLabelPosition = {
        x: sourceX + ADD_BUTTON_SERVER_OFFSET,
        y: sourceY,
      };
    }

    // For a single node at same Y, go nearly straight
    if (nodesInColumn <= 1 && Math.abs(targetY - sourceY) < 5) {
      pathData = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
    } else {
      // Horizontal trunk from MCPX to connection point, then bezier to target
      const branchDx = Math.abs(targetX - connectionX);
      const branchDy = Math.abs(targetY - sourceY);
      const branchDist = Math.sqrt(branchDx * branchDx + branchDy * branchDy);
      const curveOffset = Math.min(branchDist * 0.3, 40);

      pathData =
        `M ${sourceX},${sourceY}` +
        ` L ${connectionX},${sourceY}` +
        ` C ${connectionX + curveOffset},${sourceY} ${targetX - curveOffset},${targetY} ${targetX},${targetY}`;
    }
  }

  const strokeColor = isAgentToMcpx
    ? "#6B6293"
    : (style.stroke as string) || "#D8DCED";
  const addButtonKind =
    data?.addButtonKind === "agent" || data?.addButtonKind === "server"
      ? (data.addButtonKind as AddButtonKind)
      : null;
  const onAddButtonClick =
    addButtonKind === "agent"
      ? onAddAgent
      : addButtonKind === "server"
        ? onAddServer
        : undefined;

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={pathData}
        stroke={strokeColor}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {data?.animated && (
        <>
          <path
            style={{ ...style, zIndex: 10 }}
            className="react-flow__edge-path"
            d={pathData}
            stroke="var(--colors-route-active)"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="8,4"
            opacity={0.9}
          />
          <path
            style={{ ...style, zIndex: 9 }}
            d={pathData}
            stroke="var(--colors-route-active)"
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.15}
            filter="blur(1px)"
          />
        </>
      )}
      {addButtonKind && addButtonLabelPosition && onAddButtonClick && (
        <EdgeLabelRenderer>
          <Button
            variant="node-card"
            size="icon"
            title={addButtonKind === "agent" ? "Add Agent" : "Add Server"}
            aria-label={addButtonKind === "agent" ? "Add Agent" : "Add Server"}
            className="nodrag nopan absolute pointer-events-auto"
            style={{
              transform: `translate(-50%, -50%) translate(${addButtonLabelPosition.x}px, ${addButtonLabelPosition.y}px)`,
            }}
            onClick={(event) => {
              event.stopPropagation();
              onAddButtonClick();
            }}
          >
            <Plus />
          </Button>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default CustomCurvedEdge;
