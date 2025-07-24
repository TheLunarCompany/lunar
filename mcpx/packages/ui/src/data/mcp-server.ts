import {
  RawCreateTargetServerRequest,
  RawUpdateTargetServerRequest,
} from "@mcpx/shared-model";
import { useMutation } from "@tanstack/react-query";
import { axiosClient } from "./axios-client";

export async function addMcpServer({
  payload,
}: {
  payload: RawCreateTargetServerRequest;
}) {
  const response = await axiosClient.post("/target-server", payload);
  return response.data;
}

export const useAddMcpServer = () =>
  useMutation({
    mutationKey: ["add-mcp-Server"],
    mutationFn: addMcpServer,
  });

export async function deleteMcpServer(params: { name: string }) {
  const response = await axiosClient.delete(`/target-server/${params.name}`);
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
  payload: RawUpdateTargetServerRequest;
}) {
  const response = await axiosClient.patch(`/target-server/${name}`, payload);
  return response.data;
}

export const useEditMcpServer = () =>
  useMutation({
    mutationKey: ["edit-mcp-Server"],
    mutationFn: editMcpServer,
  });
