import { useQuery } from "@tanstack/react-query";
import {
  CatalogMCPServerItem,
  catalogMCPServerListSchema,
} from "@mcpx/shared-model";

import {
  CatalogMCPServerConfigByNameList,
  CatalogMCPServerConfigByNameItem,
} from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { getMcpxServerURL } from "@/config/api-config";
import { z } from "zod/v4";

export async function getMCPServers(): Promise<CatalogMCPServerConfigByNameList> {
  const url = getMcpxServerURL("http");
  const response = await fetch(`${url}/catalog/mcp-servers`, {
    credentials: "include",
  });
  const data = await response.json();
  const result = catalogMCPServerListSchema.safeParse(data);
  if (!result.success) {
    console.error(`Schema validation failed for GET catalog/mcp-servers`, {
      error: z.prettifyError(result.error),
      data,
    });
    throw result.error;
  }
  return result.data.map(addNameToCatalogMcpServerConfig);
}

export function useGetMCPServers(): ReturnType<
  typeof useQuery<CatalogMCPServerConfigByNameList, Error>
> {
  return useQuery<CatalogMCPServerConfigByNameList, Error>({
    queryKey: ["get-catalog-mcp-servers"],
    queryFn: async () => await getMCPServers(),
  });
}

function addNameToCatalogMcpServerConfig(
  item: CatalogMCPServerItem,
): CatalogMCPServerConfigByNameItem {
  const { name, config, ...rest } = item;
  const namedConfig = { [name]: config };
  return {
    ...rest,
    name: name,
    config: namedConfig,
  };
}
