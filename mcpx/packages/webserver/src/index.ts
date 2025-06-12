import { env } from "./env.js";
import { logger } from "./logger.js";
import { Services } from "./services/services.js";
import { buildWebserverServer } from "./server/build-server.js";

const { PORT } = env;

async function main(): Promise<void> {
  const services = new Services();
  const webserverServer = buildWebserverServer(services);
  await webserverServer.listen(PORT, () => {
    logger.info(`Webserver started on port ${PORT}`);
  });
}

// Run
main().catch((error) => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});
