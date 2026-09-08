import type { Agent, McpServer } from "@/types";
import type { McpServerStatus } from "@/types/mcp-server";
import { SERVER_STATUS } from "@/types/mcp-server";

type AppConfigLayoutData = {
  targetServerAttributes?: Record<string, { inactive?: boolean }>;
} | null;

type MeasuredNodeLayoutKeyInput = {
  agents: Array<Pick<Agent, "id" | "identifier">>;
  appConfig: AppConfigLayoutData;
  mcpServersData:
    | Array<
        Pick<McpServer, "id" | "name" | "status" | "tools"> &
          Partial<Pick<McpServer, "missingEnvVars">>
      >
    | null
    | undefined;
  mcpxStatus: string;
  version?: string;
};

function getEffectiveServerStatus(
  server: Pick<McpServer, "name" | "status">,
  appConfig: AppConfigLayoutData,
): McpServerStatus {
  const isInactive =
    appConfig?.targetServerAttributes?.[server.name]?.inactive === true;

  return isInactive ? SERVER_STATUS.connected_inactive : server.status;
}

export function getMeasuredNodeLayoutKey({
  agents,
  appConfig,
  mcpServersData,
  mcpxStatus,
  version,
}: MeasuredNodeLayoutKeyInput): string {
  return JSON.stringify({
    agents: agents.map((agent) => ({
      id: agent.id,
      identifier: agent.identifier,
    })),
    mcpxStatus,
    servers: (mcpServersData ?? []).map((server) => ({
      id: server.id,
      name: server.name,
      status: getEffectiveServerStatus(server, appConfig),
      toolsCount: server.tools.length,
      missingEnvVarsCount: server.missingEnvVars?.length ?? 0,
    })),
    version: version ?? "Unknown",
  });
}
