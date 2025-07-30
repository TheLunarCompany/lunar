import { z } from "zod/v4";
import { ConfigService, loadConfig } from "./config.js";
import { env, NON_SECRET_KEYS, redactEnv } from "./env.js";
import { buildMcpxServer } from "./server/build-server.js";
import { Services } from "./services/services.js";
import { startMetricsEndpoint } from "./server/prometheus.js";
import { buildLogger } from "@mcpx/toolkit-core/logging";
import { buildControlPlaneStreaming } from "./services/control-plane-streaming.js";
import { GracefulShutdown } from "@mcpx/toolkit-core/app";

const { MCPX_PORT, LOG_LEVEL } = env;

// Graceful shutdown handling
const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
signals.forEach((sig) =>
  process.on(sig, async () => {
    console.log(`Received ${sig}, attempting to shut down gracefully...`);
    await GracefulShutdown.shutdown();
  }),
);

async function main(): Promise<void> {
  const telemetry = env.LUNAR_TELEMETRY
    ? {
        service: "mcpx",
        host: `https://${env.LOKI_HOST}`,
        labels: {
          service: "mcpx",
          version: env.VERSION,
          instance_id: env.INSTANCE_ID,
          lunar_key: env.LUNAR_API_KEY,
        },
      }
    : undefined;

  const logger = buildLogger({ logLevel: LOG_LEVEL, label: "mcpx", telemetry });
  GracefulShutdown.registerCleanup("logger", () => logger.close());

  logger.info("Starting MCPX server...");
  logger.telemetry.info("Starting MCPX server...");
  logger.debug("Env vars read", redactEnv(env, NON_SECRET_KEYS));
  const configLoad = loadConfig();
  if (!configLoad.success) {
    logger.error("Invalid config file", z.treeifyError(configLoad.error));
    process.exit(1);
  }
  const configService = new ConfigService(configLoad.data, logger);
  logger.debug("Config loaded successfully", configService.getConfig());

  const meterProvider = startMetricsEndpoint(
    logger.child({ component: "Metrics" }),
  );
  const services = new Services(configService, meterProvider, logger);
  await services.initialize();
  GracefulShutdown.registerCleanup("services", () => services.shutdown());

  const streaming = buildControlPlaneStreaming(services.controlPlane, logger);

  GracefulShutdown.registerCleanup("streaming", () => streaming.shutdown());

  const mcpxServer = await buildMcpxServer(configService, services, logger);

  await mcpxServer.listen(MCPX_PORT, () => {
    logger.info(`MCPX server started on port ${MCPX_PORT}`);
  });
}

// Run
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
