import { CreateTargetServerRequest } from "@mcpx/shared-model";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

// TODO: Make reading from env work
const API_SERVER_URL =
  import.meta.env.VITE_API_SERVER_URL || "http://localhost:9001";

export async function addMcpServer({
  payload,
}: {
  payload: CreateTargetServerRequest;
}) {
  const response = await axios.post(`${API_SERVER_URL}/target-server`, payload);
  return response.data;
}

export const useAddMcpServer = () =>
  useMutation({
    mutationKey: ["add-mcp-Server"],
    mutationFn: addMcpServer,
  });

export async function deleteMcpServer(params: { name: string }) {
  const response = await axios.delete(
    `${API_SERVER_URL}/target-server/${params.name}`,
  );
  return response.data;
}

export const useDeleteMcpServer = () =>
  useMutation({
    mutationKey: ["delete-mcp-Server"],
    mutationFn: deleteMcpServer,
  });
