import { createContext, useContext } from "react";

type AddButtonActions = {
  onAddAgent?: () => void;
  onAddServer?: () => void;
};

const AddButtonActionsContext = createContext<AddButtonActions>({});

export const AddButtonActionsProvider = AddButtonActionsContext.Provider;

export function useAddButtonActions(): AddButtonActions {
  return useContext(AddButtonActionsContext);
}
