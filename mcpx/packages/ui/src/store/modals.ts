import { TargetServer } from "@mcpx/shared-model";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

export interface ModalsStore {
  // Add Server Modal
  isAddServerModalOpen: boolean;
  openAddServerModal: () => void;
  closeAddServerModal: () => void;

  // Edit Server Modal
  isEditServerModalOpen: boolean;
  openEditServerModal: () => void;
  closeEditServerModal: () => void;
  editServerModalData?: TargetServer;

  // Config Modal
  isConfigModalOpen: boolean;
  openConfigModal: () => void;
  closeConfigModal: () => void;
}

const modalsStore = create<ModalsStore>((set) => ({
  isAddServerModalOpen: false,
  openAddServerModal: () => set({ isAddServerModalOpen: true }),
  closeAddServerModal: () => set({ isAddServerModalOpen: false }),
  isConfigModalOpen: false,
  openConfigModal: () => set({ isConfigModalOpen: true }),
  closeConfigModal: () => set({ isConfigModalOpen: false }),
  isEditServerModalOpen: false,
  openEditServerModal: () => set({ isEditServerModalOpen: true }),
  closeEditServerModal: () => set({ isEditServerModalOpen: false }),
}));

export const useModalsStore = <T>(selector: (state: ModalsStore) => T) =>
  modalsStore(useShallow(selector));
