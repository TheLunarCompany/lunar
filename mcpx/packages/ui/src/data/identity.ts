import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GetIdentityResponse,
  Identity,
  UI_ClientBoundMessage,
} from "@mcpx/shared-model";
import { apiClient } from "@/lib/api";
import { useEffect } from "react";
import { useSocketStore } from "@/store";

const IDENTITY_QUERY_KEY = ["identity"];

export function useIdentity() {
  return useQuery<GetIdentityResponse, Error>({
    queryKey: IDENTITY_QUERY_KEY,
    queryFn: () => apiClient.getIdentity(),
    staleTime: 5 * 60 * 1000, // Consider identity stable for 5 minutes
  });
}

// mcpx-server pushes IdentityChanged when the hub updates identity (e.g. OBO
// started/finished). Keep the cached identity in sync so the banner reacts live,
// without waiting for the staleTime to expire.
export function useIdentityLiveSync(): void {
  const socket = useSocketStore((s) => s.socket);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) {
      return;
    }
    const handler = (payload: GetIdentityResponse): void => {
      queryClient.setQueryData(IDENTITY_QUERY_KEY, payload);
    };
    socket.on(UI_ClientBoundMessage.IdentityChanged, handler);
    return () => {
      socket.off(UI_ClientBoundMessage.IdentityChanged, handler);
    };
  }, [socket, queryClient]);
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

// The admin currently editing this space on its behalf (OBO), or undefined when
// the identity is not a space under OBO. Falls back through name → email → generic.
export function getSpaceEditedByLabel(identity: Identity): string | undefined {
  if (identity.mode === "personal" || identity.entity.entityType !== "space") {
    return undefined;
  }
  const editedBy = identity.entity.editedBy;
  if (!editedBy) {
    return undefined;
  }
  return editedBy.adminDisplayName ?? editedBy.adminEmail ?? "an admin";
}

// True when this pod is a space currently under OBO edit (any kind). Drives UI
// that only applies while an admin edits a space on its behalf (e.g. hiding the
// Add Agent affordance).
export function useIsEditingSpaceOnBehalf(): boolean {
  const { data } = useIdentity();
  const identity = data?.identity;
  if (!identity || identity.mode === "personal") {
    return false;
  }
  if (identity.entity.entityType !== "space") {
    return false;
  }
  return !!identity.entity.editedBy;
}

// Client-facing noun for the space kind; unknown kinds fall back to "space".
export function getSpaceKindLabel(identity: Identity): string {
  if (identity.mode === "personal" || identity.entity.entityType !== "space") {
    return "space";
  }
  switch (identity.entity.spaceKind) {
    case "HOSTED_MCP_SERVER":
      return "hosted MCP server";
    case "AGENT_CONNECTOR":
      return "agent environment";
    default:
      return "space";
  }
}

export function getSpaceName(identity: Identity): string | undefined {
  if (identity.mode === "personal" || identity.entity.entityType !== "space") {
    return undefined;
  }
  return identity.entity.spaceName;
}
