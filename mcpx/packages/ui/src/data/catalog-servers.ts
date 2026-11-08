import { useQuery } from "@tanstack/react-query";

import { CatalogMCPServerConfigByNameList } from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { apiClient } from "@/lib/api";

type CatalogServersQueryOptions = {
  enabled?: boolean;
};

export function useGetMCPServers({
  enabled = true,
}: CatalogServersQueryOptions = {}): ReturnType<
  typeof useQuery<CatalogMCPServerConfigByNameList, Error>
> {
  return useQuery<CatalogMCPServerConfigByNameList, Error>({
    queryKey: ["get-catalog-mcp-servers"],
    queryFn: () => apiClient.getCatalogServers(),
    enabled,
  });
}
