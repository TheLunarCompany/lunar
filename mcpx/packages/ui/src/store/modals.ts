import { ToolDetails } from "@/types";
import { TargetServerNew } from "@mcpx/shared-model";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { CustomTool } from "./tools";

export interface ModalsStore {
  // Add Server Modal
  isAddServerModalOpen: boolean;
  openAddServerModal: () => void;
  closeAddServerModal: () => void;

  // Edit Server Modal
  isEditServerModalOpen: boolean;
  openEditServerModal: (initialData: TargetServerNew) => void;
  closeEditServerModal: () => void;
  editServerModalData?: TargetServerNew;

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
}));

export const useModalsStore = <T>(selector: (state: ModalsStore) => T) =>
  modalsStore(useShallow(selector));
