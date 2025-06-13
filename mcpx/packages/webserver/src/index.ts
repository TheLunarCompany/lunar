import { env } from "./env.js";

import { Services } from "./services/services.js";
import { buildWebserverServer } from "./server/build-server.js";
import { buildLogger } from "@mcpx/toolkit-core/logging";

const { PORT, LOG_LEVEL } = env;
const logger = buildLogger({ logLevel: LOG_LEVEL, label: "webserver" });

async function main(): Promise<void> {
  const services = new Services(logger);
  const webserverServer = buildWebserverServer(services, logger);
  await webserverServer.listen(PORT, () => {
    logger.info(`Webserver started on port ${PORT}`);
  });
}

// Run
main().catch((error) => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});
