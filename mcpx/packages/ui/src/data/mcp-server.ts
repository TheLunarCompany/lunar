import {
  createTargetServerRequestSchema,
  updateTargetServerRequestSchema,
  TargetServerNew,
} from "@mcpx/shared-model";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod/v4";
import { socketStore } from "@/store/socket";

export type TargetServerInput = z.input<typeof createTargetServerRequestSchema>;
export type UpdateTargetServerInput = z.input<
  typeof updateTargetServerRequestSchema
>;

// WebSocket-based target server operations
export function addMcpServer({
  payload,
}: {
  payload: TargetServerInput;
}): Promise<TargetServerNew> {
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
      resolve({ name: data.name } as TargetServerNew);
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
