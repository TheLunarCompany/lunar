import { useQuery } from "@tanstack/react-query";
import { CatalogMCPServerList } from "@mcpx/shared-model";
import { axiosClient } from "./axios-client";
import { getMcpxServerURL } from "@/config/api-config";

export async function getMCPServers(): Promise<CatalogMCPServerList> {
  const url = getMcpxServerURL("http");
  const response = await axiosClient.get(`${url}/catalog/mcp-servers`);
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
