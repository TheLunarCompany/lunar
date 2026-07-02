import {
  ApplyParsedAppConfigRequest,
  SerializedAppConfig,
} from "@mcpx/shared-model";
import { useMutation, useQuery } from "@tanstack/react-query";
import { axiosClient } from "./axios-client";
import { apiClient } from "@/lib/api";

export async function getAppConfig(): Promise<SerializedAppConfig> {
  const response = await axiosClient.get("/app-config");
  return response.data;
}

export const useGetAppConfig = () =>
  useQuery({
    queryKey: ["get-app-config"],
    queryFn: getAppConfig,
  });

export function useUpdateAppConfig() {
  return useMutation({
    mutationKey: ["update-app-config"],
    mutationFn: async (
      params: ApplyParsedAppConfigRequest,
    ): Promise<SerializedAppConfig> => {
      return await apiClient.patchAppConfig(params);
    },
  });
}
