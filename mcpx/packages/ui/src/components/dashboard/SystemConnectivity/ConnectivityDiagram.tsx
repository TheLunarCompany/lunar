import { Controls, OnSelectionChangeParams, ReactFlow } from "@xyflow/react";
import { ServerIcon } from "lucide-react";
import { useCallback } from "react";
import { Card } from "../../ui/card";
import { MiniMap } from "./MiniMap";
import { nodeTypes } from "./nodes";
import { useReactFlowData } from "./nodes/use-react-flow-data";
import { AgentData, McpServerData } from "./types";

export default function ConnectivityDiagram({
  agents,
  onMcpServerClick,
  mcpServersData,
  mcpxStatus,
  onAgentClick,
  onMcpxClick,
  selectedAgent,
  selectedServer,
}: {
  agents: Array<{
    id: string;
    identifier: string;
    status: "connected" | "disconnected";
    isSelected?: boolean;
  }>;
  onMcpServerClick: (server: McpServerData) => void;
  mcpServersData: Array<McpServerData> | null | undefined;
  mcpxStatus: string;
  onAgentClick: (agent: AgentData) => void;
  onMcpxClick: () => void;
  selectedAgent?: AgentData;
  selectedServer?: McpServerData;
}) {
  const { edges, nodes, onEdgesChange, onNodesChange, translateExtent } =
    useReactFlowData({
      agents,
      mcpServersData,
      mcpxStatus,
      onAgentClick,
      onMcpServerClick,
      selectedAgent,
      selectedServer,
    });

  const handleSelectionChange = useCallback(
    (selection: OnSelectionChangeParams) => {
      if (selection.nodes.length === 0) {
        return onMcpxClick();
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
    [onMcpxClick, onMcpServerClick, onAgentClick],
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
        onSelectionChange={handleSelectionChange}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        nodesConnectable={false}
        nodesDraggable={false}
        nodes={nodes}
        edges={edges}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
        disableKeyboardA11y
        elevateNodesOnSelect
        fitView
        panOnScroll
      >
        <MiniMap />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
