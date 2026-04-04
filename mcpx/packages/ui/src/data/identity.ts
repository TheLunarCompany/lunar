import { useQuery } from "@tanstack/react-query";
import { GetIdentityResponse, Identity } from "@mcpx/shared-model";
import { apiClient } from "@/lib/api";

export function useIdentity() {
  return useQuery<GetIdentityResponse, Error>({
    queryKey: ["identity"],
    queryFn: () => apiClient.getIdentity(),
    staleTime: 5 * 60 * 1000, // Consider identity stable for 5 minutes
  });
}

export function isEnterpriseIdentity(identity: Identity): boolean {
  return identity.mode === "enterprise";
}

export function isAdminIdentity(identity: Identity): boolean {
  if (identity.mode === "personal") {
    return false;
  }
  if (identity.entity.entityType === "space") {
    return false;
  }
  return identity.entity.role === "admin";
}
