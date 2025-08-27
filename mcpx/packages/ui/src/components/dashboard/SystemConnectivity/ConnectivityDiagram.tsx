import { Card } from "@/components/ui/card";
import { useDashboardStore } from "@/store";
import { Agent, McpServer } from "@/types";
import { Controls, Node, ReactFlow } from "@xyflow/react";
import { ServerIcon, Brain, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { MiniMap } from "./MiniMap";
import { nodeTypes } from "./nodes";
import { useReactFlowData } from "./nodes/use-react-flow-data";
import { AgentNode, McpServerNode } from "./types";
import { AddAgentModal } from "./nodes/AddAgentModal";
import { AddServerModal } from "../AddServerModal";

export const ConnectivityDiagram = ({
  agents,
  mcpServersData,
  mcpxStatus,
}: {
  agents: Array<Agent>;
  mcpServersData: Array<McpServer> | null | undefined;
  mcpxStatus: string;
}) => {
  const { edges, nodes, onEdgesChange, onNodesChange, translateExtent } =
    useReactFlowData({
      agents,
      mcpServersData,
      mcpxStatus,
    });

  const { setCurrentTab } = useDashboardStore((s) => ({
    setCurrentTab: s.setCurrentTab,
  }));

  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);
  const [isAddServerModalOpen, setIsAddServerModalOpen] = useState(false);

  const onItemClick = useCallback(
    (node: Node) => {
      switch (node.type) {
        case "agent":
          setCurrentTab("agents", {
            setSearch: {
              agents: (node as AgentNode).data.identifier,
              servers: "",
            },
          });
          break;
        case "mcpServer":
          setCurrentTab("servers", {
            setSearch: {
              agents: "",
              servers: (node as McpServerNode).data.name,
            },
          });
          break;
        case "mcpx":
          setCurrentTab("mcpx");
          break;
      }
    },
    [setCurrentTab],
  );

  // Check if we only have placeholder nodes (MCPX + NoAgents + NoServers)
  const hasOnlyPlaceholders = nodes.length === 3 && 
    nodes.some(n => n.type === "mcpx") &&
    nodes.some(n => n.type === "noAgents") &&
    nodes.some(n => n.type === "noServers");

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
    <div className="w-full h-full">
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_event, node) => onItemClick(node)}
        fitView
        className="bg-[var(--color-bg-container)]"
      >
        <Controls />
        <MiniMap />
      </ReactFlow>

      {isAddAgentModalOpen && (
        <AddAgentModal
          isOpen={isAddAgentModalOpen}
          onClose={() => setIsAddAgentModalOpen(false)}
        />
      )}

      {isAddServerModalOpen && (
        <AddServerModal
          onClose={() => setIsAddServerModalOpen(false)}
        />
      )}
    </div>
  );
};
