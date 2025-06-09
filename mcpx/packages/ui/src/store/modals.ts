import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

export interface ModalsStore {
  isAddServerModalOpen: boolean;
  openAddServerModal: () => void;
  closeAddServerModal: () => void;
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
}));

export const useModalsStore = <T>(
  selector: (state: ModalsStore) => T,
) => modalsStore(useShallow(selector));
