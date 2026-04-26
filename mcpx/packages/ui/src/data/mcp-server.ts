import {
  RawCreateTargetServerRequest,
  TargetServer,
  updateTargetServerRequestSchema,
} from "@mcpx/shared-model";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod/v4";
import { socketStore } from "@/store/socket";
import { apiClient } from "@/lib/api";

export type UpdateTargetServerInput = z.input<
  typeof updateTargetServerRequestSchema
>;

// WebSocket-based target server operations
function addMcpServerUsingWebSocket(
  payload: RawCreateTargetServerRequest,
): Promise<TargetServer> {
  return new Promise((resolve, reject) => {
    const { emitAddTargetServer, isConnected, socket } = socketStore.getState();

    if (!isConnected || !socket) {
      reject(new Error("Socket not connected"));
      return;
    }

    // Set up event listeners for the response
    const handleSuccess = (data: { name: string }) => {
      socket.off("targetServerAdded", handleSuccess);
      socket.off("addTargetServerFailed", handleError);
      resolve({ name: data.name } as TargetServer);
    };

    const handleError = (data: { error: string }) => {
      socket.off("targetServerAdded", handleSuccess);
      socket.off("addTargetServerFailed", handleError);
      reject(new Error(data.error));
    };

    // Listen for the response
    socket.on("targetServerAdded", handleSuccess);
    socket.on("addTargetServerFailed", handleError);

    // Emit the request
    emitAddTargetServer(payload);
  });
}

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
    return addMcpServerUsingWebSocket(payload);
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
  return new Promise((resolve, reject) => {
    const { emitRemoveTargetServer, socket } = socketStore.getState();

    if (!socket) {
      reject(new Error("Socket not connected"));
      return;
    }

    const handleSuccess = (data: { name: string }) => {
      socket.off("targetServerRemoved", handleSuccess);
      socket.off("removeTargetServerFailed", handleError);
      resolve({ message: `Target server ${data.name} removed successfully` });
    };

    const handleError = (data: { error: string }) => {
      socket.off("targetServerRemoved", handleSuccess);
      socket.off("removeTargetServerFailed", handleError);
      reject(new Error(data.error));
    };

    socket.on("targetServerRemoved", handleSuccess);
    socket.on("removeTargetServerFailed", handleError);

    emitRemoveTargetServer(name);
  });
}

export const useDeleteMcpServer = () =>
  useMutation({
    mutationKey: ["delete-mcp-Server"],
    mutationFn: deleteMcpServer,
  });

// @@@ TODO: check if this can also be replaced using the REST endpoint
export function editMcpServer({
  name,
  payload,
}: {
  name: string;
  payload: UpdateTargetServerInput;
}): Promise<{ name: string }> {
  return new Promise((resolve, reject) => {
    const { emitUpdateTargetServer, socket } = socketStore.getState();

    if (!socket) {
      reject(new Error("Socket not connected"));
      return;
    }

    const handleSuccess = (data: { name: string }) => {
      socket.off("targetServerUpdated", handleSuccess);
      socket.off("updateTargetServerFailed", handleError);
      resolve({ name: data.name });
    };

    const handleError = (data: { error: string }) => {
      socket.off("targetServerUpdated", handleSuccess);
      socket.off("updateTargetServerFailed", handleError);
      reject(new Error(data.error));
    };

    socket.on("targetServerUpdated", handleSuccess);
    socket.on("updateTargetServerFailed", handleError);

    emitUpdateTargetServer(name, payload);
  });
}

export const useEditMcpServer = () =>
  useMutation({
    mutationKey: ["edit-mcp-Server"],
    mutationFn: editMcpServer,
  });
