import { z } from "zod/v4";
import { ConfigService, loadConfig } from "./config.js";
import { env, redactEnv } from "./env.js";
import { buildMcpxServer } from "./server/build-server.js";
import { Services } from "./services/services.js";
import { startMetricsEndpoint } from "./server/prometheus.js";
import { buildLogger, loggableError } from "@mcpx/toolkit-core/logging";
import { GracefulShutdown } from "@mcpx/toolkit-core/app";
import { compileRanges } from "@mcpx/toolkit-core/ip-access";
import { withPolling } from "@mcpx/toolkit-core/time";

const { MCPX_PORT, LOG_LEVEL } = env;

// Graceful shutdown handling
const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
signals.forEach((sig) => {
  process.on(sig, async () => {
    console.log(`Received ${sig}, attempting to shut down gracefully...`);
    await GracefulShutdown.shutdown();
  });
});

async function logStatusSummary(
  logger: ReturnType<typeof buildLogger>,
  services: Services,
): Promise<void> {
  const apiKeyStatus = env.LUNAR_API_KEY ? "Provided" : "Not provided";
  let uiStatus = "Not connected";
  try {
    await withPolling({
      maxAttempts: 10,
      sleepTimeMs: 500,
      getValue: () => services.connections.uiSocket !== null,
      found: (connected): connected is true => connected,
    });
    uiStatus = "Connected";
  } catch {
    uiStatus = "Not connected";
  }
  const summary = [
    "Lunar MCPX Status Summary",
    "MCPX:",
    `\tInstance ID: ${env.INSTANCE_ID}`,
    `\tVersion: ${env.VERSION}`,
    `\tLog Level: ${env.LOG_LEVEL}`,
    `\tMCPX Port: ${env.MCPX_PORT}`,
    `\tUI Port: ${env.UI_PORT ?? "N/A"}`,
    `\tAPI Key: ${apiKeyStatus}`,
    `\tUI Connection: ${uiStatus}`,
  ].join("\n");
  logger.info(summary);
  logger.telemetry.info(summary);
  if (uiStatus === "Connected" && env.UI_PORT) {
    const url = `http://localhost:${env.UI_PORT}`;
    logger.info(`🚀 MCPX server is up and UI available at ${url}`);
  }
}

async function main(): Promise<void> {
  const telemetry = env.LUNAR_TELEMETRY
    ? {
        service: "mcpx",
        host: `https://${env.LOKI_HOST}`,
        user: env.LOKI_USER,
        password: env.LOKI_PASSWORD,
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
  logger.debug("Env vars read", redactEnv(env));
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
  services.systemStateTracker.setMcpxVersion(env.VERSION);
  GracefulShutdown.registerCleanup("services", () => services.shutdown());

  let allowedIpRanges: ReturnType<typeof compileRanges> | undefined;
  try {
    allowedIpRanges = env.ALLOWED_IP_RANGES
      ? compileRanges(env.ALLOWED_IP_RANGES)
      : undefined;
  } catch (e) {
    logger.error(
      "Shutting down: Failed to parse ALLOWED_IP_RANGES, check environment variable value",
      { error: loggableError(e) },
    );
    await GracefulShutdown.shutdown();
  }
  const mcpxServer = await buildMcpxServer(
    configService,
    services,
    allowedIpRanges,
    logger,
  );

  await mcpxServer.listen(MCPX_PORT, async () => {
    logger.info(`MCPX server started on port ${MCPX_PORT}`);
    await logStatusSummary(logger, services);
  });
}

// Run
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
