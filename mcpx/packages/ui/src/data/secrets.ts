import { useQuery } from "@tanstack/react-query";
import { type SecretKeys } from "@mcpx/shared-model";
import { apiClient } from "@/lib/api";
import { useFeatureFlag } from "@/contexts/feature-flags";

export async function fetchSecrets(): Promise<SecretKeys> {
  const secrets = await apiClient.getSecrets();
  return secrets;
}

export function sortSecrets(data: SecretKeys): SecretKeys {
  return [...data].sort((a, b) => a.localeCompare(b));
}

export function useGetSecrets() {
  const isBoomi = useFeatureFlag("VITE_IS_BOOMI");

  return useQuery<SecretKeys, Error>({
    queryKey: ["get-secrets"],
    queryFn: fetchSecrets,
    enabled: !isBoomi,
    select: sortSecrets,
  });
}
