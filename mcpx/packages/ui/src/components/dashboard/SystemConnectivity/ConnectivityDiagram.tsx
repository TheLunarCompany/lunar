import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDashboardStore, useModalsStore } from "@/store";
import { Agent, McpServer } from "@/types";
import { serversEqual } from "@/utils/server-comparison";
import { Controls, Node, Panel, ReactFlow, useReactFlow } from "@xyflow/react";

import { Plus, ServerIcon } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MiniMap } from "./MiniMap";
import { edgeTypes, nodeTypes } from "./nodes";
import { useReactFlowData } from "./nodes/use-react-flow-data";
import { AgentNode, McpServerNode } from "./types";
import { AddAgentModal } from "./nodes/AddAgentModal";
import { AddServerModal } from "../AddServerModal";
import { AgentDetailsModal } from "../AgentDetailsModal";
import { McpxDetailsModal } from "../McpxDetailsModal";
import { useToast } from "@/components/ui/use-toast";

/** Fits view once on initial load so nodes appear centered from the start; does not resize on add/remove node. */
const AutoFitView = ({ nodes }: { nodes: Node[] }) => {
  const { fitView } = useReactFlow();
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (nodes.length > 0 && !hasInitializedRef.current) {
      hasInitializedRef.current = true;

      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      const aspectRatio = screenWidth / screenHeight;
      let maxZoom = 0.6;

      if (screenWidth < 1024) {
        maxZoom = 0.4;
      } else if (screenWidth < 1440) {
        maxZoom = 0.5;
      } else if (screenWidth < 1920) {
        maxZoom = 0.7;
      } else {
        maxZoom = 0.8;
      }

      if (screenHeight < 600) {
        maxZoom = Math.max(maxZoom - 0.1, 0.3);
      } else if (screenHeight > 1080) {
        maxZoom = Math.min(maxZoom + 0.1, 0.8);
      }

      if (aspectRatio > 1.8) {
        maxZoom = Math.min(maxZoom + 0.1, 0.8);
      } else if (aspectRatio < 1.2) {
        maxZoom = Math.max(maxZoom - 0.1, 0.3);
      }

      // Fit immediately with no animation so nodes start centered from the beginning
      requestAnimationFrame(() => {
        fitView({
          padding: 0.2,
          maxZoom,
          duration: 0,
        });
      });
    }
  }, [nodes.length, fitView]);

  return null;
};

const ConnectivityDiagramComponent = ({
  agents,
  mcpServersData,
  mcpxStatus,
  version,
  initialOpenAddServerModal = false,
}: {
  agents: Array<Agent>;
  mcpServersData: Array<McpServer> | null | undefined;
  mcpxStatus: string;
  version?: string;
  initialOpenAddServerModal?: boolean;
}) => {
  const { edges, onEdgesChange, onNodesChange, translateExtent, ...flowData } =
    useReactFlowData({
      agents,
      mcpServersData,
      mcpxStatus,
      version,
    });

  const nodes = flowData.nodes;

  const { setCurrentTab } = useDashboardStore((s) => ({
    setCurrentTab: s.setCurrentTab,
  }));

  const { openServerDetailsModal } = useModalsStore((s) => ({
    openServerDetailsModal: s.openServerDetailsModal,
  }));
  const {
    openAgentDetailsModal,
    isAgentDetailsModalOpen,
    selectedAgent,
    closeAgentDetailsModal,
  } = useModalsStore((s) => ({
    openAgentDetailsModal: s.openAgentDetailsModal,
    isAgentDetailsModalOpen: s.isAgentDetailsModalOpen,
    selectedAgent: s.selectedAgent,
    closeAgentDetailsModal: s.closeAgentDetailsModal,
  }));
  const {
    openMcpxDetailsModal,
    isMcpxDetailsModalOpen,
    selectedMcpxData,
    closeMcpxDetailsModal,
  } = useModalsStore((s) => ({
    openMcpxDetailsModal: s.openMcpxDetailsModal,
    isMcpxDetailsModalOpen: s.isMcpxDetailsModalOpen,
    selectedMcpxData: s.selectedMcpxData,
    closeMcpxDetailsModal: s.closeMcpxDetailsModal,
  }));

  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);
  const [isAddServerModalOpen, setIsAddServerModalOpen] = useState(false);
  const { dismiss } = useToast();
  const prevInitialOpenRef = useRef(false);
  const navigate = useNavigate();

  const handleAddServerModalClose = useCallback(() => {
    setIsAddServerModalOpen(false);
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (initialOpenAddServerModal && !prevInitialOpenRef.current) {
      setIsAddServerModalOpen(true);
    }
    prevInitialOpenRef.current = initialOpenAddServerModal;
  }, [initialOpenAddServerModal]);

  const onItemClick = useCallback(
    (node: Node) => {
      try {
        switch (node.type) {
          case "agent": {
            const agentData = (node as AgentNode).data;

            if (
              agentData &&
              agentData.sessionIds &&
              agentData.sessionIds.length > 0
            ) {
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
          }
          case "mcpServer": {
            // Find the server data and open the server details modal
            const serverData = mcpServersData?.find(
              (server) => server.name === (node as McpServerNode).data.name,
            );
            if (serverData) {
              openServerDetailsModal(serverData);
            }
            break;
          }
          case "mcpx": {
            const mcpxData = (
              node as Node<{ status: string; version?: string }>
            ).data;
            if (mcpxData) {
              openMcpxDetailsModal({
                status: mcpxData.status,
                version: mcpxData.version,
              });
            }
            break;
          }
          default:
            // Other node types don't need click handling
            break;
        }
      } catch (_error) {
        if (node.type === "agent") {
          setCurrentTab("agents");
        }
      }
    },
    [
      setCurrentTab,
      openServerDetailsModal,
      openMcpxDetailsModal,
      openAgentDetailsModal,
      mcpServersData,
    ],
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
    <div
      className="w-full relative overflow-hidden mt-0 p-2"
      style={{
        height: "calc(100vh - 210px)",
        minHeight: "300px",
        marginTop: 0,
      }}
    >
      <ReactFlow
        key="system-connectivity"
        colorMode="system"
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
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
        onNodeClick={(_event: React.MouseEvent, node: Node) =>
          onItemClick(node)
        }
        fitView={false}
        className="bg-white"
      >
        <AutoFitView nodes={nodes} />
        <Controls showInteractive={false} />
        <MiniMap />
        <Panel position="top-left" className="w-full">
          <div className="flex justify-between items-start w-full">
            <p className="text-sm md:text-base font-bold text-[var(--color-text-primary)]">
              System Connectivity
            </p>
            <div className="flex items-center gap-2 pr-7">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  dismiss();
                  setIsAddAgentModalOpen(true);
                }}
                className=" px-2 text-[14px] rounded-[8px] border border-[#5147E4] bg-white hover:enabled:bg-white text-[var(--color-fg-interactive)]"
              >
                <Plus className="w-3 h-3 " />
                Add Agent
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  dismiss();
                  setIsAddServerModalOpen(true);
                }}
                className=" px-2 text-[14px] rounded-[8px] border border-[#5147E4] bg-white hover:enabled:bg-white text-[var(--color-fg-interactive)]"
              >
                <Plus className="w-3 h-3 " />
                Add Server
              </Button>
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {isAddAgentModalOpen && (
        <AddAgentModal
          isOpen={isAddAgentModalOpen}
          onClose={() => setIsAddAgentModalOpen(false)}
        />
      )}

      {isAddServerModalOpen && (
        <AddServerModal onClose={handleAddServerModalClose} />
      )}

      {isAgentDetailsModalOpen && selectedAgent && (
        <AgentDetailsModal
          agent={selectedAgent}
          isOpen={isAgentDetailsModalOpen}
          onClose={closeAgentDetailsModal}
        />
      )}

      {isMcpxDetailsModalOpen && selectedMcpxData && (
        <McpxDetailsModal
          mcpxData={selectedMcpxData}
          isOpen={isMcpxDetailsModalOpen}
          onClose={closeMcpxDetailsModal}
        />
      )}
    </div>
  );
};

// Memoize to prevent re-renders when props haven't actually changed
export const ConnectivityDiagram = memo(
  ConnectivityDiagramComponent,
  (prevProps, nextProps) => {
    // Compare agents by ID and identifier
    const agentsEqual =
      prevProps.agents.length === nextProps.agents.length &&
      prevProps.agents.every((prevAgent, index) => {
        const nextAgent = nextProps.agents[index];
        return (
          prevAgent.id === nextAgent.id &&
          prevAgent.identifier === nextAgent.identifier &&
          prevAgent.status === nextAgent.status
        );
      });

    const prevServers = prevProps.mcpServersData || [];
    const nextServers = nextProps.mcpServersData || [];
    const serversAreEqual = serversEqual(prevServers, nextServers);

    // Compare other props
    const otherPropsEqual =
      prevProps.mcpxStatus === nextProps.mcpxStatus &&
      prevProps.version === nextProps.version &&
      prevProps.initialOpenAddServerModal ===
        nextProps.initialOpenAddServerModal;

    return agentsEqual && serversAreEqual && otherPropsEqual;
  },
);
