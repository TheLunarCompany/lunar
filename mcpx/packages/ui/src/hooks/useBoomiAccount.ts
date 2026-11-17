import {
  skipToken,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
import { z } from "zod";

import { getAuthBffUrl, isPendoEnabled } from "@/config/runtime-config";
import { useAuth } from "@/contexts/useAuth";

const boomiSessionResponseSchema = z.object({
  accountId: z.string().optional(),
});

type BoomiAccount = {
  accountId: string;
};

async function fetchBoomiAccount(
  authBffUrl: string,
): Promise<BoomiAccount | null> {
  const response = await fetch(`${authBffUrl}/runtime/boomi/session`, {
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  const result = boomiSessionResponseSchema.safeParse(await response.json());
  if (!result.success || !result.data.accountId?.trim()) {
    return null;
  }

  return { accountId: result.data.accountId.trim() };
}

export function useBoomiAccount(): UseQueryResult<BoomiAccount | null, Error> {
  const authBffUrl = getAuthBffUrl();
  const { isAuthenticated, loading } = useAuth();

  return useQuery({
    queryKey: ["boomi-account", authBffUrl],
    queryFn: authBffUrl
      ? (): Promise<BoomiAccount | null> => fetchBoomiAccount(authBffUrl)
      : skipToken,
    enabled:
      isPendoEnabled() && Boolean(authBffUrl) && isAuthenticated && !loading,
    retry: false,
    refetchOnWindowFocus: true,
  });
}
