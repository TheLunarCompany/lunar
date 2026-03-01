import { Agent, McpServer, ToolDetails } from "@/types";
import { TargetServer } from "@mcpx/shared-model";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { CustomTool } from "./tools";
import { McpxData } from "@/components/dashboard/SystemConnectivity/types";

export interface ModalsStore {
  // Add Server Modal
  isAddServerModalOpen: boolean;
  openAddServerModal: () => void;
  closeAddServerModal: () => void;

  // Edit Server Modal
  isEditServerModalOpen: boolean;
  openEditServerModal: (initialData: TargetServer) => void;
  closeEditServerModal: () => void;
  editServerModalData?: TargetServer;

  // Config Modal
  isConfigModalOpen: boolean;
  openConfigModal: () => void;
  closeConfigModal: () => void;

  // Custom tool Modal
  isCustomToolModalOpen: boolean;
  openCustomToolModal: (tool: CustomTool) => void;
  closeCustomToolModal: () => void;
  selectedTool?: CustomTool | null;

  // Tool details Modal
  isToolDetailsModalOpen: boolean;
  openToolDetailsModal: (toolDetails: ToolDetails) => void;
  closeToolDetailsModal: () => void;
  toolDetails?: ToolDetails | null;

  // Server details Modal
  isServerDetailsModalOpen: boolean;
  openServerDetailsModal: (server: McpServer) => void;
  closeServerDetailsModal: () => void;
  selectedServer?: McpServer | null;

  // Agent details Modal
  isAgentDetailsModalOpen: boolean;
  openAgentDetailsModal: (agent: Agent) => void;
  closeAgentDetailsModal: () => void;
  selectedAgent?: Agent | null;

  // Mcpx details Modal
  isMcpxDetailsModalOpen: boolean;
  openMcpxDetailsModal: (mcpxData: McpxData) => void;
  closeMcpxDetailsModal: () => void;
  selectedMcpxData?: McpxData | null;
  isMcpxSaving: boolean;
  setIsMcpxSaving: (saving: boolean) => void;
}

const modalsStore = create<ModalsStore>((set) => ({
  isAddServerModalOpen: false,
  openAddServerModal: () => set({ isAddServerModalOpen: true }),
  closeAddServerModal: () => set({ isAddServerModalOpen: false }),
  isConfigModalOpen: false,
  openConfigModal: () => set({ isConfigModalOpen: true }),
  closeConfigModal: () => set({ isConfigModalOpen: false }),
  isEditServerModalOpen: false,
  openEditServerModal: (initialData) =>
    set({ isEditServerModalOpen: true, editServerModalData: initialData }),
  closeEditServerModal: () =>
    set({ isEditServerModalOpen: false, editServerModalData: undefined }),
  isCustomToolModalOpen: false,
  openCustomToolModal: (tool) =>
    set({ isCustomToolModalOpen: true, selectedTool: tool }),
  closeCustomToolModal: () =>
    set({ isCustomToolModalOpen: false, selectedTool: null }),
  isToolDetailsModalOpen: false,
  openToolDetailsModal: (toolDetails) =>
    set({ isToolDetailsModalOpen: true, toolDetails }),
  closeToolDetailsModal: () =>
    set({ isToolDetailsModalOpen: false, toolDetails: null }),
  isServerDetailsModalOpen: false,
  openServerDetailsModal: (server) =>
    set({ isServerDetailsModalOpen: true, selectedServer: server }),
  closeServerDetailsModal: () =>
    set({ isServerDetailsModalOpen: false, selectedServer: null }),
  isAgentDetailsModalOpen: false,
  openAgentDetailsModal: (agent) =>
    set({ isAgentDetailsModalOpen: true, selectedAgent: agent }),
  closeAgentDetailsModal: () =>
    set({ isAgentDetailsModalOpen: false, selectedAgent: undefined }),
  isMcpxDetailsModalOpen: false,
  openMcpxDetailsModal: (mcpxData) =>
    set({ isMcpxDetailsModalOpen: true, selectedMcpxData: mcpxData }),
  closeMcpxDetailsModal: () =>
    set({ isMcpxDetailsModalOpen: false, selectedMcpxData: undefined }),
  isMcpxSaving: false,
  setIsMcpxSaving: (saving: boolean) => set({ isMcpxSaving: saving }),
}));

export const useModalsStore = <T>(selector: (state: ModalsStore) => T) =>
  modalsStore(useShallow(selector));
