import {
  ApplyAppConfigRequest,
  GetAppConfigResponse,
} from "@mcpx/shared-model";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const API_SERVER_URL =
  import.meta.env.VITE_API_SERVER_URL || "http://localhost:9001";

export async function getAppConfig(): Promise<GetAppConfigResponse> {
  const response = await axios.get(`${API_SERVER_URL}/app-config`);
  return response.data;
}

export const useGetAppConfig = () =>
  useQuery({
    queryKey: ["get-app-config"],
    queryFn: getAppConfig,
  });

export async function updateAppConfig(params: ApplyAppConfigRequest) {
  const response = await axios.patch(`${API_SERVER_URL}/app-config/`, params);
  return response.data;
}

export const useUpdateAppConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["update-app-config"],
    mutationFn: updateAppConfig,
  });
};
