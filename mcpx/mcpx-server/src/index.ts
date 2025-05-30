import dotenv from "dotenv";
import express from "express";
import { buildApiKeyGuard } from "./server/auth.js";
import { loadConfig, validateConfig } from "./config.js";
import { accessLog, logger } from "./logger.js";
import { buildAdminRouter } from "./server/admin.js";
import { buildSSERouter } from "./server/sse.js";
import { buildStreamableHttpRouter } from "./server/streamable.js";
import { initializeServices } from "./services/services.js";

dotenv.config();

const API_KEY = process.env["API_KEY"];
const PORT = Number(process.env["PORT"]) || 9000;

const app = express();
app.use(accessLog);
app.use(express.json());

const configLoad = loadConfig();
if (!configLoad.success) {
  logger.error("Invalid config file", configLoad.error.format());
  process.exit(1);
}
logger.debug("Config loaded successfully", configLoad.data);
const config = configLoad.data;
validateConfig(config, { apiKey: API_KEY });

const apiKeyGuard: express.RequestHandler = buildApiKeyGuard(config, API_KEY);
const services = await initializeServices(config, logger);

const streamableRouter = buildStreamableHttpRouter(apiKeyGuard, services);
app.use(streamableRouter);

const sseRouter = buildSSERouter(apiKeyGuard, services);
app.use(sseRouter);

const adminRouter = buildAdminRouter(apiKeyGuard, services);
app.use(adminRouter);

async function main(): Promise<void> {
  logger.info("Starting mcpx server... ⚡️");
  app.listen(PORT);
}

main()
  .then(() => logger.info(`Server started on port ${PORT}`))
  .catch((error) => {
    logger.error("Fatal error in main():", error);
    process.exit(1);
  });
