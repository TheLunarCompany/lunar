import {
  createTargetServerRequestSchema,
  updateTargetServerRequestSchema,
} from "@mcpx/shared-model";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod/v4";
import { axiosClient } from "./axios-client";

export type TargetServerInput = z.input<typeof createTargetServerRequestSchema>;
export type UpdateTargetServerInput = z.input<
  typeof updateTargetServerRequestSchema
>;

export async function addMcpServer({
  payload,
}: {
  payload: TargetServerInput;
}) {
  const response = await axiosClient.post("/target-server", payload);
  return response.data;
}

export const useAddMcpServer = () =>
  useMutation({
    mutationKey: ["add-mcp-Server"],
    mutationFn: addMcpServer,
  });

export async function deleteMcpServer({ name }: { name: string }) {
  const response = await axiosClient.delete(
    `/target-server/${encodeURIComponent(name)}`,
  );
  return response.data;
}

export const useDeleteMcpServer = () =>
  useMutation({
    mutationKey: ["delete-mcp-Server"],
    mutationFn: deleteMcpServer,
  });

export async function editMcpServer({
  name,
  payload,
}: {
  name: string;
  payload: UpdateTargetServerInput;
}) {
  const response = await axiosClient.patch(
    `/target-server/${encodeURIComponent(name)}`,
    payload,
  );
  return response.data;
}

export const useEditMcpServer = () =>
  useMutation({
    mutationKey: ["edit-mcp-Server"],
    mutationFn: editMcpServer,
  });
