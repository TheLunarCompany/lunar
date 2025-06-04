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

export function shutdownServices(services: Services, logger: Logger): void {
  logger.info("Shutting down services...");

  // Close all sessions
  for (const sessionId in services.sessions) {
    const session = services.sessions[sessionId];
    if (session) {
      logger.info("Closing session transport", { sessionId });
      session.transport.transport.close().catch((e) => {
        logger.error("Error closing session transport", e);
      });
      delete services.sessions[sessionId];
    }
  }

  // Shutdown target clients
  services.targetClients.shutdown();

  logger.info("All services shut down successfully");
}
