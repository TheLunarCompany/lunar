import { z } from "zod/v4";
import { ConfigManager, loadConfig } from "./config.js";
import { env } from "./env.js";
import { buildMcpxServer } from "./server/build-server.js";
import { Services } from "./services/services.js";
import { startMetricsEndpoint } from "./server/prometheus.js";
import { buildLogger } from "@mcpx/toolkit-core/logging";
import { buildControlPlaneStreaming } from "./services/control-plane-streaming.js";

const { PORT, LOG_LEVEL } = env;

const logger = buildLogger({ logLevel: LOG_LEVEL, label: "mcpx" });

// Graceful shutdown handling
const cleanupFns: Array<() => void> = [];
const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
signals.forEach((sig) =>
  process.on(sig, async () => {
    logger.info(`Received ${sig}, shutting down gracefully...`);
    await Promise.all(cleanupFns.map((fn) => fn()));
    process.exit(0);
  }),
);

async function main(): Promise<void> {
  const configLoad = loadConfig();
  if (!configLoad.success) {
    logger.error("Invalid config file", z.treeifyError(configLoad.error));
    process.exit(1);
  }
  const configManager = new ConfigManager(configLoad.data);
  configManager.validate(env);
  logger.debug("Config loaded successfully", configManager.getConfig());

  const meterProvider = startMetricsEndpoint(
    logger.child({ component: "Metrics" }),
  );
  const services = new Services(configManager, meterProvider, logger);
  await services.initialize();
  cleanupFns.push(() => services.shutdown());

  const streaming = buildControlPlaneStreaming(
    services.systemStateTracker,
    services.controlPlane,
    logger,
  );

  cleanupFns.push(() => streaming.shutdown());

  const mcpxServer = await buildMcpxServer(configManager, services, logger);

  await mcpxServer.listen(PORT, () => {
    logger.info(`MCPX server started on port ${PORT}`);
  });
}

// Run
main().catch((error) => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});
