import { env } from "./env.js";

import { Services } from "./services/services.js";
import { buildWebserverServer } from "./server/build-server.js";
import { buildLogger } from "@mcpx/toolkit-core/logging";
import { GracefulShutdown } from "@mcpx/toolkit-core/app";

const { WEBSERVER_PORT, LOG_LEVEL } = env;

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
        user: env.LOKI_USER,
        password: env.LOKI_PASSWORD,
        labels: {
          service: "webserver",
          version: env.VERSION,
          instance_id: env.INSTANCE_ID,
          lunar_key: env.LUNAR_API_KEY,
        },
      }
    : undefined;

  const logger = buildLogger({
    logLevel: LOG_LEVEL,
    label: "webserver",
    telemetry,
  });
  GracefulShutdown.registerCleanup("logger", () => logger.close());
  const services = new Services(logger);
  const webserverServer = buildWebserverServer(services, logger);
  GracefulShutdown.registerCleanup("webserver", () => webserverServer.close());
  await webserverServer.listen(WEBSERVER_PORT, () => {
    logger.info(`Webserver started on port ${WEBSERVER_PORT}`);
  });
}

// Run
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
