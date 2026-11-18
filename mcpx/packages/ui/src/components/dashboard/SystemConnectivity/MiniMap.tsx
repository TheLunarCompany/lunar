import { MiniMap as ReactFlowMiniMap } from "@xyflow/react";

export const MiniMap = () => (
  <ReactFlowMiniMap
    bgColor="var(--mcpx-surface)"
    nodeStrokeWidth={2}
    nodeBorderRadius={8}
    nodeColor="currentColor"
    nodeClassName={(node) => {
      const colorsMap: Record<string, string> = {
        mcpx: "text-mcpx-node-hub",
        mcpServer: "text-mcpx-node-server",
        agent: "text-mcpx-node-agent",
        noAgents: "text-mcpx-route-inactive",
      };
      return `rounded-md ${(node.type && colorsMap[node.type]) || "text-mcpx-text-tertiary"}`;
    }}
    className="m-6! overflow-hidden rounded-[var(--border-radius-sm)] border border-mcpx-border-subtle shadow-none!"
    style={{ width: 160, height: 120 }}
    pannable
    draggable
    zoomable
  />
);
