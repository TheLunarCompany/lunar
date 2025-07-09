import { SerializedAppConfig } from "@mcpx/shared-model";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";

const API_SERVER_URL =
  import.meta.env.VITE_API_SERVER_URL || "http://localhost:9001";

export async function getAppConfig(): Promise<SerializedAppConfig> {
  const response = await axios.get(`${API_SERVER_URL}/app-config`);
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
  const response = await axios.patch(`${API_SERVER_URL}/app-config/`, params);
  return response.data;
}

export const useUpdateAppConfig = () =>
  useMutation({
    mutationKey: ["update-app-config"],
    mutationFn: updateAppConfig,
  });
