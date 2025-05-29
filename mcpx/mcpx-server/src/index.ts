import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import express from "express";
import { accessLog, logger } from "./logger.js";
import { TargetClients } from "./target-clients.js";
import { compact, loggableError } from "./utils.js";
import { McpxSession } from "./model.js";
import { PermissionManager } from "./permissions.js";
import { loadConfig } from "./config.js";

dotenv.config();
const SERVICE_DELIMITER = "__";

const PORT = Number(process.env["PORT"]) || 9000;

const targetClients = new TargetClients(logger);
const app = express();
app.use(accessLog);
app.use(express.json());

const configLoad = loadConfig();
if (!configLoad.success) {
  logger.error("Invalid config file", configLoad.error.format());
  process.exit(1);
}
logger.debug("Config loaded successfully", configLoad.data);
const config = configLoad.data || {
  permissions: { base: "allow", consumers: {} },
  toolGroups: [],
};
const permissionManager = new PermissionManager(config);
permissionManager.initialize();

app.post("/reload", async (_req, res) => {
  try {
    logger.info("Reloading target servers");
    await targetClients.initialize();
    logger.debug(
      "Current clientsByService",
      Object.fromEntries(targetClients.clientsByService.entries()),
    );
    for (const sessionId in sessions) {
      const session = sessions[sessionId];
      if (session) {
        logger.info("Closing session transport", { sessionId });
        await session.transport.close().catch((e) => {
          const error = loggableError(e);
          logger.error("Error closing session transport", error);
        });
        delete sessions[sessionId];
      }
    }
    logger.info("All sessions closed");
    res.status(200).send("Connected to all available target servers");
  } catch (e) {
    const error = loggableError(e);
    logger.error("Error connecting to target servers", error);
    res.status(500).send("Error connecting to target servers");
  }
});

const sessions: { [sessionId: string]: McpxSession } = {};

app.get("/sse", async (_req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const sessionId = transport.sessionId;
  sessions[transport.sessionId] = { transport, consumerConfig: undefined };
  logger.info("SSE connection established", {
    sessionId,
    transports: {
      ids: Object.keys(sessions),
      count: Object.keys(sessions).length,
    },
  });

  res.on("close", () => {
    delete sessions[transport.sessionId];
    logger.info("SSE connection closed", { sessionId });
  });

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query["sessionId"] as string;
  const consumerTag = req.headers["x-lunar-consumer-tag"] as string | undefined;
  const session = sessions[sessionId];

  if (session) {
    if (session.consumerTag === undefined) {
      session.consumerTag = consumerTag;
    }
    logger.info("Handling message", { sessionId, consumerTag });

    logger.info("sending message to transport");
    await session.transport.handlePostMessage(req, res, req.body);
  }
});

const server = new Server(
  { name: "mcpx", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// Define available tools
server.setRequestHandler(
  ListToolsRequestSchema,
  async (_request, { sessionId }) => {
    logger.info("ListToolsRequest received");
    const consumerTag = sessionId
      ? sessions[sessionId]?.consumerTag
      : undefined;
    const allTools = (
      await Promise.all(
        Array.from(targetClients.clientsByService.entries()).flatMap(
          async ([serviceName, client]) => {
            const { tools } = await client.listTools();
            return compact(
              tools.map((tool) => {
                const hasPermission = permissionManager.hasPermission({
                  serviceName,
                  toolName: tool.name,
                  consumerTag,
                });
                if (!hasPermission) {
                  return null;
                }
                return {
                  ...tool,
                  name: `${serviceName}${SERVICE_DELIMITER}${tool.name}`,
                };
              }),
            );
          },
        ),
      )
    ).flat();
    logger.debug("ListToolsRequest response", { allTools });
    return { tools: allTools };
  },
);

// Handle tool execution
server.setRequestHandler(
  CallToolRequestSchema,
  async (request, { sessionId }) => {
    logger.info("CallToolRequest received", { method: request.method });
    logger.debug("CallToolRequest params", { request: request.params });
    const consumerTag = sessionId
      ? sessions[sessionId]?.consumerTag
      : undefined;

    const [serviceName, toolName] =
      request?.params?.name?.split(SERVICE_DELIMITER) || [];
    if (!serviceName) {
      throw new Error("Invalid service name");
    }
    if (!toolName) {
      throw new Error("Invalid tool name");
    }
    const hasPermission = permissionManager.hasPermission({
      serviceName,
      toolName,
      consumerTag,
    });
    if (!hasPermission) {
      throw new Error("Permission denied");
    }
    const client = targetClients.clientsByService.get(serviceName);
    if (!client) {
      throw new Error("Client not found");
    }
    return await client.callTool({
      name: toolName,
      arguments: request.params.arguments,
    });
  },
);

async function main(): Promise<void> {
  logger.info("Starting mcpx server... ⚡️");
  await targetClients.initialize();
  app.listen(PORT);
}

main()
  .then(() => logger.info(`Server started on port ${PORT}`))
  .catch((error) => {
    logger.error("Fatal error in main():", error);
    process.exit(1);
  });
