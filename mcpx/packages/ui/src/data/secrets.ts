import { useQuery } from "@tanstack/react-query";
import { type SecretKeys } from "@mcpx/shared-model";
import { apiClient } from "@/lib/api";

export function useGetSecrets() {
  return useQuery<SecretKeys, Error>({
    queryKey: ["get-secrets"],
    queryFn: () => apiClient.getSecrets(),
    select: (data) => [...data].sort((a, b) => a.localeCompare(b)),
  });
}
