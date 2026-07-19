import {
  RawCreateTargetServerRequest,
  TargetServer,
  UpdateTargetServerRequest,
} from "@mcpx/shared-model";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export function addMcpServer({
  payload,
}: {
  payload: RawCreateTargetServerRequest;
}): Promise<TargetServer> {
  // if a env variable was left empty - replace it with an explicit "null"
  if (payload.type && payload.type == "stdio") {
    if (payload.env) {
      for (const key of Object.keys(payload.env)) {
        // Convert empty string to null
        if (payload.env[key] === "") {
          payload.env[key] = null;
        }
      }
    }
  }
  const envValues = payload.type === "stdio" ? payload.env : undefined; // if not stdio send undefined env to endpoint, its ok
  if (payload.catalogItemId) {
    return apiClient.addCatalogServer(payload.catalogItemId, {
      envValues: envValues,
    });
  } else {
    return apiClient.addTargetServer(payload);
  }
}

export const useAddMcpServer = () =>
  useMutation({
    mutationKey: ["add-mcp-Server"],
    mutationFn: addMcpServer,
  });

export function deleteMcpServer({
  name,
}: {
  name: string;
}): Promise<{ message: string }> {
  return apiClient.deleteTargetServer(name);
}

export const useDeleteMcpServer = () =>
  useMutation({
    mutationKey: ["delete-mcp-Server"],
    mutationFn: deleteMcpServer,
  });

export function editMcpServer({
  name,
  payload,
}: {
  name: string;
  payload: UpdateTargetServerRequest;
}): Promise<TargetServer> {
  if (payload.catalogItemId) {
    return apiClient.updateCatalogServer(payload.catalogItemId, payload);
  } else {
    return apiClient.updateTargetServer(name, payload);
  }
}

export const useEditMcpServer = () =>
  useMutation({
    mutationKey: ["edit-mcp-Server"],
    mutationFn: editMcpServer,
  });

// Enable/disable a server via the dedicated activate/deactivate endpoints, which
// flip one attribute server-side — avoids the read-modify-write race of patching
// the whole app-config just to toggle `inactive`.
export function setTargetServerActive({
  name,
  active,
}: {
  name: string;
  active: boolean;
}): Promise<{ message: string }> {
  return active
    ? apiClient.activateTargetServer(name)
    : apiClient.deactivateTargetServer(name);
}

export const useSetTargetServerActive = () =>
  useMutation({
    mutationKey: ["set-target-server-active"],
    mutationFn: setTargetServerActive,
  });
