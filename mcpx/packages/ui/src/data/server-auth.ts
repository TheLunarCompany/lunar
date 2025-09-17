import { InitiateServerAuthResult } from "@mcpx/shared-model";
import { useMutation } from "@tanstack/react-query";
import { axiosClient } from "./axios-client";
import { getMcpxServerURL } from "@/config/api-config";

export async function initiateServerAuth({
  serverName,
}: {
  serverName: string;
}): Promise<InitiateServerAuthResult["data"]> {
  const response = await axiosClient.post<InitiateServerAuthResult["data"]>(
    `/auth/initiate/${encodeURIComponent(serverName)}`,
    {
      callbackUrl: `${getMcpxServerURL("http")}/auth/callback`,
    },
  );
  return response.data;
}

export const useInitiateServerAuth = () =>
  useMutation({
    mutationKey: ["initiate-server-auth"],
    mutationFn: initiateServerAuth,
  });
