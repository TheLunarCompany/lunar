import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import express from "express";
import { accessLog, logger } from "./logger.js";
import { messageSchema, Tool } from "./model.js";
import { TargetClients } from "./target-clients.js";
import { loggableError } from "./utils.js";
import { z } from "zod";

dotenv.config();
const SERVICE_DELIMITER = "__";

const PORT = Number(process.env["PORT"]) || 9000;

const targetClients = new TargetClients(logger);
const app = express();
app.use(accessLog);
app.use(express.json());

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

const sessions: {
  [sessionId: string]: {
    transport: SSEServerTransport;
    allowedTools: Set<string>;
  };
} = {};

app.get("/allTools", async (_req, res) => {
  logger.info("Handling GET allTools");
  const allTools = await getAllTools().then((tools) =>
    tools.map((tool) => tool.name),
  );
  logger.debug("GET allTools response", { allTools });
  res.status(200).json({ tools: allTools });
});

app.get("/sse", async (_req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const sessionId = transport.sessionId;
  sessions[transport.sessionId] = { transport, allowedTools: new Set() };
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
  logger.info("Handling POST message", { headers: req.headers });
  logger.info("POST message body", { body: req.body });

  const allowedToolsHeader = req.headers["x-mcpx-allowed-tools"];
  const allowedTools = new Set(
    Array.isArray(allowedToolsHeader)
      ? allowedToolsHeader
      : (allowedToolsHeader || "").split(","),
  );

  const decoded = messageSchema.safeParse(req.body);
  if (!decoded.success) {
    logger.error("Invalid message", { error: decoded.error });
    res.status(400).send("Invalid message");
    return;
  }
  if (
    decoded.data.method === "tools/call" &&
    decoded.data.params?.name &&
    !allowedTools.has(decoded.data.params.name)
  ) {
    logger.info("Tool not allowed", {
      tool: decoded.data.params.name,
      allowedTools: Array.from(allowedTools),
    });
    res.status(403).send("Tool not allowed");
    return;
  }
  const sessionId = req.query["sessionId"] as string;
  const session = sessions[sessionId];
  if (session) {
    logger.info("Handling message", { sessionId });
    session.allowedTools = allowedTools;
    logger.info("Body before", { body: req.body });
    req.body.foo = "bar"; // Example of modifying the request body
    req.body.params = req.body.params || {};
    req.body.params.sessionId = sessionId;
    logger.info("Body after", { body: req.body });
    await session.transport.handlePostMessage(req, res, req.body);
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
server.setRequestHandler(
  ListToolsRequestSchema.extend({ foo: z.string() }),
  async (bla) => {
    logger.info("ListToolsRequest received");
    const allTools = await getAllTools();
    logger.info("session id from within", {
      sessionId: bla.params?.["sessionId"],
    });
    logger.debug("ListToolsRequest response", { allTools });
    return { tools: allTools };
  },
);

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  logger.info("CallToolRequest received", {
    method: request.method,
    params: request.params,
  });

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

async function getAllTools(): Promise<Tool[]> {
  return (
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
}
main()
  .then(() => {
    logger.info(`Server started on port ${PORT}`);
  })
  .catch((error) => {
    logger.error("Fatal error in main():", error);
    process.exit(1);
  });
