import { MiniMap as ReactFlowMiniMap } from "@xyflow/react";

export const MiniMap = () => (
  <ReactFlowMiniMap
    bgColor="rgba(255, 255, 255, 0.5)"
    nodeStrokeWidth={2}
    nodeBorderRadius={8}
    nodeColor="currentColor"
    nodeClassName={(node) => {
      const colorsMap: Record<string, string> = {
        mcpx: "text-[var(--color-mcpx-server)]",
        mcpServer: "text-[var(--color-active-server)]",
        agent: "text-[var(--color-active-agent)]",
        noAgents: "text-[var(--color-no-agents)]",
      };
      return `rounded-md ${(node.type && colorsMap[node.type]) || "text-gray-500"}`;
    }}
    className="backdrop-blur-sm"
    style={{ width: 100, height: 100 }}
    pannable
    draggable
    zoomable
  />
);
