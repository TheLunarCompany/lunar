import { Server } from "http";
import { Logger } from "winston";
import { ConfigManager, loadConfig } from "./config.js";
import { env } from "./env.js";
import { mcpxLogger, webserverLogger } from "./logger.js";
import { buildMcpxServer } from "./server/build-server.js";
import { Services } from "./services/services.js";
import { buildWebserverServer } from "./webserver/build-server.js";

const { PORT, WEBSERVER_PORT } = env;

// Graceful shutdown handling
const cleanupFns: Array<() => void> = [];
const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
signals.forEach((sig) =>
  process.on(sig, async () => {
    mcpxLogger.info(`Received ${sig}, shutting down gracefully...`);
    await Promise.all(cleanupFns.map((fn) => fn()));
    process.exit(0);
  }),
);

// Spin up the main server and webserver if not disabled
async function main(): Promise<void> {
  const configLoad = loadConfig();
  if (!configLoad.success) {
    mcpxLogger.error("Invalid config file", configLoad.error.format());
    process.exit(1);
  }
  const configManager = new ConfigManager(configLoad.data);
  configManager.validate(env);
  mcpxLogger.debug("Config loaded successfully", configManager.getConfig());

  const services = new Services(configManager, mcpxLogger);
  await services.initialize();
  cleanupFns.push(() => services.shutdown());

  const mcpxServer = await buildMcpxServer(configManager, services);
  const tasks = [startServer(mcpxServer, PORT, mcpxLogger, "MCPX")];
  if (env.ENABLE_WEBSERVER) {
    const webserverServer = buildWebserverServer(configManager, services);
    tasks.push(
      startServer(
        webserverServer,
        WEBSERVER_PORT,
        webserverLogger,
        "Webserver",
      ),
    );
  }

  await Promise.all(tasks);
}

// Run
main().catch((error) => {
  mcpxLogger.error("Fatal error in main():", error);
  process.exit(1);
});

function startServer(
  server: Server,
  port: number,
  logger: Logger,
  name: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server
      .listen(port, () => {
        logger.info(`${name} started on port ${port}`);
        resolve();
      })
      .on("error", (error) => reject(error));
  });
}
