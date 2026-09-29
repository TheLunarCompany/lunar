import { z } from "zod/v4";
import {
  ConfigService,
  ConfigStore,
  FileConfigStore,
  InMemoryConfigStore,
} from "./config.js";
import { env, redactEnv } from "./env.js";
import { buildMcpxServer } from "./server/build-server.js";
import { Services } from "./services/services.js";
import { startMetricsEndpoint } from "./server/prometheus.js";
import {
  buildLogger,
  loggableError,
  logFormatForEnv,
} from "@mcpx/toolkit-core/logging";
import { GracefulShutdown } from "@mcpx/toolkit-core/app";
import { compileRanges } from "@mcpx/toolkit-core/ip-access";

const { MCPX_PORT, LOG_LEVEL } = env;

async function checkUIReadiness(): Promise<boolean> {
  if (!env.UI_PORT) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${env.UI_URL}`, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return response.ok || (response.status >= 200 && response.status < 400);
  } catch (_) {
    return false;
  }
}

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
): Promise<void> {
  const apiKeyStatus = env.LUNAR_API_KEY ? "Provided" : "Not provided";

  const uiConnected = await checkUIReadiness();

  const summaryFields = {
    instanceId: env.INSTANCE_ID,
    version: env.VERSION,
    logLevel: env.LOG_LEVEL,
    mcpxPort: env.MCPX_PORT,
    uiPort: env.UI_PORT ?? "N/A",
    apiKey: apiKeyStatus,
    uiStatus: uiConnected ? "Connected" : "Not Connected",
  };
  logger.info("Lunar MCPX Status Summary", summaryFields);
  logger.telemetry.info("Lunar MCPX Status Summary", summaryFields);

  if (uiConnected && env.UI_PORT) {
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

  const logger = buildLogger({
    logLevel: LOG_LEVEL,
    label: "mcpx",
    format: logFormatForEnv(env.NODE_ENV),
    telemetry,
    redactKeys: new Set(env.LOG_REDACT_KEYS),
  });
  GracefulShutdown.registerCleanup("logger", () => logger.close());

  logger.info("Starting MCPX server...");

  logger.telemetry.info("Starting MCPX server...");
  logger.debug("Env vars read", redactEnv(env));
  const configStore: ConfigStore = env.IS_ENTERPRISE
    ? new InMemoryConfigStore()
    : new FileConfigStore(env.APP_CONFIG_PATH);
  const configLoad = configStore.load();
  if (!configLoad.success) {
    logger.error("Invalid config file", z.treeifyError(configLoad.error));
    process.exit(1);
  }
  const configService = new ConfigService(configLoad.data, configStore, logger);
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

  await mcpxServer.listen(MCPX_PORT, () => {
    logger.info(`MCPX server started on port ${MCPX_PORT}`);
    logStatusSummary(logger);
  });
}

// Run
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
