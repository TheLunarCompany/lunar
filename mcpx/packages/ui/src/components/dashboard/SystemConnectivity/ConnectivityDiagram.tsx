import { Card } from "@/components/ui/card";
import { useDashboardStore } from "@/store";
import { Controls, Node, ReactFlow, useOnSelectionChange } from "@xyflow/react";
import { ServerIcon } from "lucide-react";
import { useCallback } from "react";
import { MiniMap } from "./MiniMap";
import { nodeTypes } from "./nodes";
import { useReactFlowData } from "./nodes/use-react-flow-data";
import { AgentData, McpServerData } from "./types";

export const ConnectivityDiagram = ({
  agents,
  mcpServersData,
  mcpxStatus,
  onAgentClick,
  onMcpServerClick,
  onMcpxClick,
  selectedId,
}: {
  agents: Array<{
    id: string;
    identifier: string;
    status: "connected" | "disconnected";
    isSelected?: boolean;
  }>;
  mcpServersData: Array<McpServerData> | null | undefined;
  mcpxStatus: string;
  onAgentClick: (agent: AgentData) => void;
  onMcpServerClick: (server: McpServerData) => void;
  onMcpxClick: () => void;
  selectedId?: string;
}) => {
  const { edges, nodes, onEdgesChange, onNodesChange, translateExtent } =
    useReactFlowData({
      agents,
      mcpServersData,
      mcpxStatus,
      selectedId,
    });

  useOnSelectionChange({
    onChange: (selection) => {
      if (selection.nodes.length === 0) {
        // Prevent deselection
        return;
      }
      if (selection.nodes[0]?.id === "mcpx") {
        return onMcpxClick();
      }
      if (selection.nodes[0]?.type === "agent") {
        return onAgentClick(selection.nodes[0].data as AgentData);
      }
      if (selection.nodes[0]?.type === "mcpServer") {
        return onMcpServerClick(selection.nodes[0].data as McpServerData);
      }
    },
  });

  const { setCurrentTab } = useDashboardStore((s) => ({
    setCurrentTab: s.setCurrentTab,
  }));

  const onItemClick = useCallback(
    (node: Node) => {
      switch (node.type) {
        case "agent":
          setCurrentTab("agents");
          break;
        case "mcpServer":
          setCurrentTab("servers");
          break;
        case "mcpx":
          setCurrentTab("mcpx");
          break;
      }
    },
    [setCurrentTab],
  );

  if (nodes.length === 0) {
    return (
      <Card className="flex justify-center items-center scale-200 m-auto w-full h-full p-1 border-dashed border-[var(--color-border-primary)] bg-[var(--color-bg-container)]">
        <div className="flex flex-col items-center gap-0.5 text-[var(--color-text-disabled)]">
          <ServerIcon className="w-2.5 h-2.5" />
          <p className="text-[7px] font-medium">No MCP servers</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <ReactFlow
        key={`system-connectivity__nodes-${nodes.length}-edges-${edges.length}`}
        colorMode="system"
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
        translateExtent={translateExtent}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        nodesConnectable={false}
        nodesDraggable={false}
        nodes={nodes}
        edges={edges}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
        onNodeClick={(_event, node) => {
          onItemClick(node);
        }}
        disableKeyboardA11y
        fitView
        panOnScroll
      >
        <MiniMap />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
};
