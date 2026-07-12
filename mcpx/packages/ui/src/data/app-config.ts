import { SerializedAppConfig } from "@mcpx/shared-model";
import { useQuery } from "@tanstack/react-query";
import { axiosClient } from "./axios-client";

export async function getAppConfig(): Promise<SerializedAppConfig> {
  const response = await axiosClient.get("/app-config");
  return response.data;
}

export const useGetAppConfig = () =>
  useQuery({
    queryKey: ["get-app-config"],
    queryFn: getAppConfig,
  });
