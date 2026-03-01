import { useQuery } from "@tanstack/react-query";
import { StrictnessResponse } from "@mcpx/shared-model";
import { apiClient } from "@/lib/api";

export function useStrictness(enabled = true) {
  return useQuery<StrictnessResponse, Error>({
    queryKey: ["admin-strictness"],
    queryFn: () => apiClient.getStrictness(),
    enabled,
  });
}
