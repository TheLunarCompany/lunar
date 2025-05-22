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
import { loggableError } from "./utils.js";

dotenv.config();
const SERVICE_DELIMITER = "__";

const PORT = Number(process.env["PORT"]) || 9000;

const targetClients = new TargetClients(logger);
const app = express();
app.use(accessLog);

app.post("/reload", async (_req, res) => {
  try {
    logger.info("Reloading target servers");
    await targetClients.initialize();
    logger.debug(
      "Current clientsByService",
      Object.fromEntries(targetClients.clientsByService.entries()),
    );
    res.status(200).send("Connected to all available target servers");
  } catch (e) {
    const error = loggableError(e);
    logger.error("Error connecting to target servers", error);
    res.status(500).send("Error connecting to target servers");
  }
});

const transports: { [sessionId: string]: SSEServerTransport } = {};

app.get("/sse", async (_req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const sessionId = transport.sessionId;
  transports[transport.sessionId] = transport;
  logger.info("SSE connection established", {
    sessionId,
    transports: {
      ids: Object.keys(transports),
      count: Object.keys(transports).length,
    },
  });

  res.on("close", () => {
    delete transports[transport.sessionId];
    logger.info("SSE connection closed", { sessionId });
  });

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query["sessionId"] as string;
  const transport = transports[sessionId];
  if (transport) {
    logger.info("Handling message", { sessionId });
    await transport.handlePostMessage(req, res);
  } else {
    logger.error("No transport found", { sessionId });
    res.status(400).send("No transport found for sessionId");
  }
});

const server = new Server(
  { name: "mcpx", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.info("ListToolsRequest received");
  const allTools = (
    await Promise.all(
      Array.from(targetClients.clientsByService.entries()).flatMap(
        async ([serviceName, client]) => {
          const { tools } = await client.listTools();
          return tools.map((tool) => {
            return {
              ...tool,
              name: `${serviceName}${SERVICE_DELIMITER}${tool.name}`,
            };
          });
        },
      ),
    )
  ).flat();
  logger.debug("ListToolsRequest response", { allTools });
  return { tools: allTools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  logger.info("CallToolRequest received", { method: request.method });
  logger.debug("CallToolRequest params", { request: request.params });

  const [serviceName, toolName] =
    request?.params?.name?.split(SERVICE_DELIMITER) || [];
  if (!serviceName) {
    throw new Error("Invalid service name");
  }
  if (!toolName) {
    throw new Error("Invalid tool name");
  }
  const client = targetClients.clientsByService.get(serviceName);
  if (!client) {
    throw new Error("Client not found");
  }
  return await client.callTool({
    name: toolName,
    arguments: request.params.arguments,
  });
});

async function main(): Promise<void> {
  logger.info("Starting mcpx server... ⚡️");
  await targetClients.initialize();
  app.listen(PORT);
}

main()
  .then(() => {
    logger.info(`Server started on port ${PORT}`);
  })
  .catch((error) => {
    logger.error("Fatal error in main():", error);
    process.exit(1);
  });
