import { useQuery } from "@tanstack/react-query";
import { CatalogMCPServerList } from "@mcpx/shared-model";
import { axiosClient } from "./axios-client";

export async function getMCPServers(): Promise<CatalogMCPServerList> {
  const response = await axiosClient.get("catalog/mcp-servers");
  return response.data;
}

export function useGetMCPServers(): ReturnType<
  typeof useQuery<CatalogMCPServerList, Error>
> {
  return useQuery<CatalogMCPServerList, Error>({
    queryKey: ["get-catalog-mcp-servers"],
    queryFn: async () => await getMCPServers(),
  });
}
