import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDashboardStore, useModalsStore, useSocketStore } from "@/store";
import { Agent, McpServer } from "@/types";
import { serversEqual } from "@/utils/server-comparison";
import { Controls, Node, Panel, ReactFlow, useReactFlow } from "@xyflow/react";

import { Plus, ServerIcon } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes } from "@/routes";
import { MiniMap } from "./MiniMap";
import { edgeTypes, nodeTypes } from "./nodes";
import { AddButtonActionsProvider } from "./nodes/add-button-actions";
import { useReactFlowData } from "./nodes/use-react-flow-data";
import { AgentNode, McpServerNode } from "./types";
import { AddAgentModal } from "./nodes/AddAgentModal";
import { AddServerModal } from "../AddServerModal";
import { AgentDetailsModal } from "../AgentDetailsModal";
import { McpxDetailsModal } from "../McpxDetailsModal";
import { useToast } from "@/components/ui/use-toast";
import { ServerContextMenu } from "./nodes/ServerContextMenu";
import { useDeleteMcpServer } from "@/data/mcp-server";
import { usePermissions } from "@/data/permissions";
import { SERVER_STATUS } from "@/types/mcp-server";
import { getEditTargetServer } from "../server-edit-target";
import { calculateContextMenuPosition } from "./context-menu-position";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

type ContextMenuState = {
  serverName: string;
  serverData: McpServer;
  isInactive: boolean;
  top?: number | false;
  left?: number | false;
  right?: number | false;
  bottom?: number | false;
} | null;

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
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);
  const [isAddServerModalOpen, setIsAddServerModalOpen] = useState(false);
  const { toast, dismiss } = useToast();
  const { canAddCustomServerAndEdit: canEditServers } = usePermissions();
  const ref = useRef<HTMLDivElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTargetName, setDeleteTargetName] = useState<string>("");

  // Stores
  const { openServerDetailsModal, openEditServerModal } = useModalsStore(
    (s) => ({
      openServerDetailsModal: s.openServerDetailsModal,
      openEditServerModal: s.openEditServerModal,
    }),
  );
  const setOptimisticallyRemovedServerName = useDashboardStore(
    (s) => s.setOptimisticallyRemovedServerName,
  );
  const { emitPatchAppConfig, appConfig } = useSocketStore((s) => ({
    emitPatchAppConfig: s.emitPatchAppConfig,
    appConfig: s.appConfig,
  }));
  const { mutate: deleteServer } = useDeleteMcpServer();

  const handleAddAgent = useCallback(() => {
    dismiss();
    setIsAddAgentModalOpen(true);
  }, [dismiss]);

  const handleAddServer = useCallback(() => {
    dismiss();
    setIsAddServerModalOpen(true);
  }, [dismiss]);

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

  const prevInitialOpenRef = useRef(false);
  const navigate = useNavigate();

  const handleAddServerModalClose = useCallback(() => {
    setIsAddServerModalOpen(false);
    navigate(routes.dashboard, { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (initialOpenAddServerModal && !prevInitialOpenRef.current) {
      setIsAddServerModalOpen(true);
    }
    prevInitialOpenRef.current = initialOpenAddServerModal;
  }, [initialOpenAddServerModal]);

  // ----- Context menu handlers -----

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.type !== "mcpServer") return;

      event.preventDefault();

      const pane = ref.current?.getBoundingClientRect();
      if (!pane) return;

      const serverData = (node as McpServerNode).data;
      const serverAttrs = appConfig?.targetServerAttributes?.[serverData.name];
      const isInactive =
        serverAttrs?.inactive === true ||
        serverData.status === SERVER_STATUS.connected_inactive;

      setContextMenu({
        serverName: serverData.name,
        serverData,
        isInactive,
        ...calculateContextMenuPosition({
          clientX: event.clientX,
          clientY: event.clientY,
          pane,
        }),
      });
    },
    [appConfig],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleContextDetails = useCallback(() => {
    if (!contextMenu) return;
    openServerDetailsModal(contextMenu.serverData);
    setContextMenu(null);
  }, [contextMenu, openServerDetailsModal]);

  const handleContextEdit = useCallback(() => {
    if (!contextMenu || !canEditServers) return;
    dismiss();
    openEditServerModal(getEditTargetServer(contextMenu.serverData));
    setContextMenu(null);
  }, [canEditServers, contextMenu, dismiss, openEditServerModal]);

  const handleContextToggleInactive = useCallback(async () => {
    if (!contextMenu) return;
    const name = contextMenu.serverName;
    const wasInactive = contextMenu.isInactive;
    setContextMenu(null);

    try {
      const currentAttrs = appConfig?.targetServerAttributes ?? {};
      await emitPatchAppConfig({
        ...appConfig,
        targetServerAttributes: {
          ...currentAttrs,
          [name]: { ...currentAttrs[name], inactive: !wasInactive },
        },
      });
    } catch {
      toast({
        title: "Error",
        description: `Failed to ${wasInactive ? "activate" : "deactivate"} server "${name}"`,
        variant: "destructive",
      });
    }
  }, [contextMenu, appConfig, emitPatchAppConfig, toast]);

  const handleContextDelete = useCallback(() => {
    if (!contextMenu) return;
    setDeleteTargetName(contextMenu.serverName);
    setContextMenu(null);
    setIsDeleteDialogOpen(true);
  }, [contextMenu]);

  const handleConfirmDelete = useCallback(() => {
    deleteServer(
      { name: deleteTargetName },
      {
        onSuccess: () => {
          setOptimisticallyRemovedServerName(deleteTargetName);
          setIsDeleteDialogOpen(false);
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: `Failed to remove server "${deleteTargetName}": ${error.message}`,
            variant: "destructive",
          });
          setIsDeleteDialogOpen(false);
        },
      },
    );
  }, [
    deleteTargetName,
    deleteServer,
    setOptimisticallyRemovedServerName,
    toast,
  ]);

  // ----- Node click -----

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
      openMcpxDetailsModal,
      openAgentDetailsModal,
      openServerDetailsModal,
      mcpServersData,
    ],
  );

  const handlePaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  if (nodes.length === 0) {
    return (
      <Card className="flex justify-center items-center scale-200 m-auto w-full h-full p-1 border-dashed border-border bg-card">
        <div className="flex flex-col items-center gap-0.5 text-(--color-text-disabled)">
          <ServerIcon className="w-2.5 h-2.5" />
          <p className="text-[7px] font-medium">No MCP servers</p>
        </div>
      </Card>
    );
  }

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden"
      style={{
        height: "calc(100vh - 240px)",
        minHeight: "300px",
        marginTop: 0,
      }}
    >
      <AddButtonActionsProvider
        value={{ onAddAgent: handleAddAgent, onAddServer: handleAddServer }}
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
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={handlePaneClick}
          fitView={false}
          className="bg-[#fbfbfe]"
        >
          <AutoFitView nodes={nodes} />
          <Controls showInteractive={false} />
          <MiniMap />
          <Panel position="top-left" className="w-full">
            <div className="flex items-center justify-end gap-2 pr-7">
              <Button variant="node-card" onClick={handleAddAgent}>
                <Plus data-icon="inline-start" />
                Add Agent
              </Button>
              <Button variant="node-card" onClick={handleAddServer}>
                <Plus data-icon="inline-start" />
                Add Server
              </Button>
            </div>
          </Panel>
          {contextMenu && (
            <ServerContextMenu
              isInactive={contextMenu.isInactive}
              canEdit={
                canEditServers &&
                contextMenu.serverData.status !== SERVER_STATUS.connecting
              }
              top={contextMenu.top}
              left={contextMenu.left}
              right={contextMenu.right}
              bottom={contextMenu.bottom}
              onDetails={handleContextDetails}
              onEdit={handleContextEdit}
              onToggleInactive={handleContextToggleInactive}
              onDelete={handleContextDelete}
              onClick={closeContextMenu}
            />
          )}
        </ReactFlow>
      </AddButtonActionsProvider>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Server</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the{" "}
              <strong>{deleteTargetName}</strong> server? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
