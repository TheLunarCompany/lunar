import { Logger } from "winston";
import { Config, McpxSession } from "../model.js";
import { PermissionManager } from "./permissions.js";
import { TargetClients } from "./target-clients.js";

export interface Services {
  sessions: Record<string, McpxSession>;
  targetClients: TargetClients;
  permissionManager: PermissionManager;
}

export async function initializeServices(
  config: Config,
  logger: Logger,
): Promise<Services> {
  const sessions: { [sessionId: string]: McpxSession } = {};
  const targetClients = new TargetClients(logger);
  const permissionManager = new PermissionManager(config);

  permissionManager.initialize();
  await targetClients.initialize();

  return {
    sessions,
    targetClients,
    permissionManager,
  };
}
