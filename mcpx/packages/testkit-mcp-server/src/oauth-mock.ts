import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { createServer } from "http";

const PORT = 9001;

// User data - each user has their own private data
const USER_DATA = {
  user_alice: [
    "Alice's secret project",
    "Alice's private notes",
    "Alice's API keys",
  ],
  user_bob: [
    "Bob's confidential files",
    "Bob's personal data",
    "Bob's passwords",
  ],
};

// Track which user is currently authorized (if any)
let currentAuthorizedUser: string | null = null;

// Track active sessions
const activeSessions = new Map<string, StreamableHTTPServerTransport>();

function createOAuthMockServer(): McpServer {
  const server = new McpServer({
    name: "test::oauth-mock",
    version: "1.0.0",
  });

  server.registerTool(
    "get-user-data",
    {
      title: "Get User Data",
      description: "Returns the current user's private data",
      inputSchema: {},
    },
    async () => {
      console.log(
        `[OAuth Mock] Tool called, authorized user: ${currentAuthorizedUser}`
      );

      // If no user is authorized, return 401
      if (!currentAuthorizedUser) {
        throw new Error("Unauthorized: No user authenticated");
      }

      // If authorized user is not recognized, return error
      if (!USER_DATA[currentAuthorizedUser as keyof typeof USER_DATA]) {
        throw new Error(
          `Unauthorized: User '${currentAuthorizedUser}' not recognized`
        );
      }

      const userData =
        USER_DATA[currentAuthorizedUser as keyof typeof USER_DATA];
      console.log(
        `[OAuth Mock] Returning data for ${currentAuthorizedUser}:`,
        userData
      );

      return {
        content: [
          {
            type: "text",
            text: `User data for ${currentAuthorizedUser}:\n${userData.join("\n")}`,
          },
        ],
      };
    }
  );

  return server;
}

async function main(): Promise<void> {
  console.log("Starting OAuth Mock MCP server...");

  // Create Express app for authorization endpoints
  const app = express();
  app.use(express.json());

  // Authorization endpoint - simulates OAuth completion
  app.post("/authorize", (req, res) => {
    const { user } = req.body as { user: "user_alice" | "user_bob" };
    console.log(`[OAuth Mock] Authorization request for user: ${user}`);

    if (!user) {
      res.status(400).json({ error: "User is required" });
      return;
    }

    // Check if user is recognized
    if (!USER_DATA[user]) {
      console.log(`[OAuth Mock] User '${user}' not recognized`);
      res.status(403).json({ error: `User '${user}' not recognized` });
      return;
    }

    currentAuthorizedUser = user;
    console.log(`[OAuth Mock] User '${user}' is now authorized`);
    res.json({ success: true, authorizedUser: user });
    return;
  });

  // Revoke authorization endpoint
  app.post("/revoke", (_req, res) => {
    const previousUser = currentAuthorizedUser;
    currentAuthorizedUser = null;
    console.log(`[OAuth Mock] Authorization revoked for user: ${previousUser}`);
    res.json({ success: true, revokedUser: previousUser });
    return;
  });

  // Status endpoint to check current state
  app.get("/status", (_req, res) => {
    console.log("[OAuth Mock] Status request received");
    res.json({
      authorizedUser: currentAuthorizedUser,
      availableUsers: Object.keys(USER_DATA),
    });
    return;
  });

  // Create MCP server (will be connected to transports per session)

  // Add MCP endpoint to handle both POST and GET requests
  app.all("/mcp", async (req, res) => {
    console.log(`[OAuth Mock] MCP request received: ${req.method} /mcp`);

    const mcpServer = createOAuthMockServer();
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (!sessionId) {
      // New session - create transport and connect
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => Math.random().toString(36).substring(2, 15),
      });

      await mcpServer.connect(transport);

      // Store session for future requests
      transport.onclose = () => {
        if (transport.sessionId) {
          activeSessions.delete(transport.sessionId);
        }
      };

      await transport.handleRequest(req, res, req.body);

      if (transport.sessionId) {
        activeSessions.set(transport.sessionId, transport);
      }
    } else {
      // Existing session - reuse transport
      const transport = activeSessions.get(sessionId);
      if (!transport) {
        res.status(404).send("Session not found");
        return;
      }

      await transport.handleRequest(req, res, req.body);
    }
  });

  const httpServer = createServer(app);

  // Start the HTTP server
  httpServer.listen(PORT, () => {
    console.log(`[OAuth Mock] Server running on http://localhost:${PORT}`);
    console.log(`[OAuth Mock] MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(
      `[OAuth Mock] Authorization endpoint: POST http://localhost:${PORT}/authorize`
    );
    console.log(
      `[OAuth Mock] Available users: ${Object.keys(USER_DATA).join(", ")}`
    );
    console.log(
      `[OAuth Mock] Currently authorized user: ${currentAuthorizedUser || "none"}`
    );
  });
}

// Run
main().catch((error) => {
  console.error("Fatal error in OAuth Mock server:", error);
  process.exit(1);
});
