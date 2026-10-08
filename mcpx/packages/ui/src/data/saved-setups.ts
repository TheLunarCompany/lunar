import { apiClient } from "@/lib/api";
import type { ListSavedSetupsResponse } from "@mcpx/shared-model";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const QUERY_KEY = ["saved-setups"] as const;

export const useGetSavedSetups = () =>
  useQuery<ListSavedSetupsResponse>({
    queryKey: QUERY_KEY,
    queryFn: () => apiClient.getSavedSetups(),
    staleTime: 0,
    refetchOnMount: "always",
  });

export const useSaveSetup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (description: string) => apiClient.saveSetup({ description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};

export const useDeleteSavedSetup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteSavedSetup({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};

export const useRestoreSavedSetup = () =>
  useMutation({
    mutationFn: (id: string) => apiClient.restoreSavedSetup({ id }),
  });

export const useResetSetup = () =>
  useMutation({
    mutationFn: () => apiClient.resetSetup(),
  });

export const useOverwriteSavedSetup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.overwriteSavedSetup({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};
