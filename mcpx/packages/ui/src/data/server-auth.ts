import { InitiateServerAuthResult } from "@mcpx/shared-model";
import { useMutation } from "@tanstack/react-query";
import { axiosClient } from "./axios-client";
import { getMcpxServerURL } from "@/config/api-config";

export async function initiateServerAuth({
  serverName,
}: {
  serverName: string;
}): Promise<InitiateServerAuthResult["data"]> {
  const url = getMcpxServerURL("http");
  const response = await axiosClient.post<InitiateServerAuthResult["data"]>(
    `${url}/auth/initiate/${encodeURIComponent(serverName)}`,
    {
      callbackUrl: `${url}/auth/callback`,
    },
  );
  return response.data;
}

export async function oauthCallback({
  code,
  state,
  error,
}: {
  code?: unknown;
  state?: unknown;
  error?: unknown;
}): Promise<string> {
  const response = await axiosClient.get(`/oauth/callback`, {
    params: { code, error, state },
    headers: {
      "Content-Type": "application/json",
    },
  });
  return response.data;
}

export const useInitiateServerAuth = () =>
  useMutation({
    mutationKey: ["initiate-server-auth"],
    mutationFn: initiateServerAuth,
  });

export const useOAuthCallback = () =>
  useMutation({
    mutationKey: ["oauth-callback"],
    mutationFn: oauthCallback,
  });
