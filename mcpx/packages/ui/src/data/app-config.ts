import { SerializedAppConfig } from "@mcpx/shared-model";
import { useMutation, useQuery } from "@tanstack/react-query";
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

export async function updateAppConfig(
  params: Pick<SerializedAppConfig, "yaml">,
): Promise<SerializedAppConfig> {
  const response = await axiosClient.patch("/app-config", params);
  return response.data;
}

export const useUpdateAppConfig = () =>
  useMutation({
    mutationKey: ["update-app-config"],
    mutationFn: updateAppConfig,
  });
