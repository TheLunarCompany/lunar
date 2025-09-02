import { Card } from "@/components/ui/card";
import { useDashboardStore, useModalsStore } from "@/store";
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
import { AgentDetailsModal } from "../AgentDetailsModal";

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

  const { openAgentDetailsModal, isAgentDetailsModalOpen, selectedAgent, closeAgentDetailsModal } = useModalsStore((s) => ({
    openAgentDetailsModal: s.openAgentDetailsModal,
    isAgentDetailsModalOpen: s.isAgentDetailsModalOpen,
    selectedAgent: s.selectedAgent,
    closeAgentDetailsModal: s.closeAgentDetailsModal,
  }));

  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);
  const [isAddServerModalOpen, setIsAddServerModalOpen] = useState(false);

  const onItemClick = useCallback(
    (node: Node) => {
      try {
        switch (node.type) {
          case "agent":
            const agentData = (node as AgentNode).data;
            
            if (agentData && agentData.sessionId) {
              openAgentDetailsModal(agentData);
            } else {
              setCurrentTab("agents", {
                setSearch: {
                  agents: agentData?.identifier || "",
                  servers: "",
                },
              });
            }
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
      } catch (error) {
        if (node.type === "agent") {
          setCurrentTab("agents");
        }
      }
    },
    [setCurrentTab, openAgentDetailsModal],
  );

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

      {isAgentDetailsModalOpen && selectedAgent && (
        <AgentDetailsModal
          agent={selectedAgent}
          isOpen={isAgentDetailsModalOpen}
          onClose={closeAgentDetailsModal}
        />
      )}
    </div>
  );
};
