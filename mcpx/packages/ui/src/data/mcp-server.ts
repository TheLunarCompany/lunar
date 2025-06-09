import { CreateTargetServerRequest } from "@mcpx/shared-model";
import { useMutation } from "@tanstack/react-query";

// TODO: Make reading from env work
const API_SERVER_URL =
  import.meta.env.VITE_API_SERVER_URL || "http://localhost:9001";

export async function addMcpServer({
  payload,
}: {
  payload: CreateTargetServerRequest;
}): Promise<void> {
  const result = await fetch(`${API_SERVER_URL}/target-server`, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  await result.json();
}

export const useAddMcpServer = () =>
  useMutation({
    mutationKey: ["add-mcp-Server"],
    mutationFn: addMcpServer,
  });

export async function deleteMcpServer(params: { name: string }) {
  const result = await fetch(
    `http://localhost:9001/target-server/${params.name}`,
    {
      method: "DELETE",
    },
  );

  await result.json();
}

export const useDeleteMcpServer = () =>
  useMutation({
    mutationKey: ["delete-mcp-Server"],
    mutationFn: deleteMcpServer,
  });
