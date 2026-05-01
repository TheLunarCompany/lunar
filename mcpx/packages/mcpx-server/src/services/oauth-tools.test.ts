import { InitiateOAuthResult } from "./oauth-connection-handler.js";
import { TargetClient } from "./target-client-types.js";
import { AUTH_TOOL_NAME, OAuthToolsService } from "./oauth-tools.js";

type TextToolContent = { type: "text"; text: string };

function getResponseText(response: unknown): string {
  return (response as { content: TextToolContent[] }).content[0]?.text ?? "";
}

interface MockUpstreamHandler {
  clientsByService: Map<string, TargetClient>;
  isOAuthServer(serverName: string): boolean;
  initiateOAuthForServer(
    serverName: string,
    callbackUrl?: string,
  ): Promise<InitiateOAuthResult>;
}

function makeConnectedClient(serverName: string): TargetClient {
  return {
    _state: "connected",
    targetServer: {
      name: serverName,
      type: "streamable-http",
      url: "https://example.com",
    },
    extendedClient: {} as never,
  };
}

function makePendingAuthClient(serverName: string): TargetClient {
  return {
    _state: "pending-auth",
    targetServer: {
      name: serverName,
      type: "streamable-http",
      url: "https://example.com",
    },
  };
}

function makeHandler(
  clients: Map<string, TargetClient>,
  oauthServers: Set<string>,
  initiateResult: InitiateOAuthResult = {
    authorizationUrl: "https://auth.example.com/authorize",
    state: "state-1",
  },
): MockUpstreamHandler {
  return {
    clientsByService: clients,
    isOAuthServer: (name) => oauthServers.has(name),
    initiateOAuthForServer: async () => initiateResult,
  };
}

describe("OAuthToolsService", () => {
  describe("getAuthTools", () => {
    it("returns empty array when no clients", () => {
      const handler = makeHandler(new Map(), new Set());
      const service = new OAuthToolsService(handler as never);

      expect(service.getAuthTools()).toEqual([]);
    });

    it("returns auth tool for pending-auth client", () => {
      const clients = new Map([["github", makePendingAuthClient("github")]]);
      const handler = makeHandler(clients, new Set());
      const service = new OAuthToolsService(handler as never);

      const tools = service.getAuthTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]?.name).toBe(`github__${AUTH_TOOL_NAME}`);
    });

    it("returns auth tool for connected OAuth server", () => {
      const clients = new Map([["github", makeConnectedClient("github")]]);
      const handler = makeHandler(clients, new Set(["github"]));
      const service = new OAuthToolsService(handler as never);

      const tools = service.getAuthTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]?.name).toBe(`github__${AUTH_TOOL_NAME}`);
    });

    it("does not return auth tool for connected non-OAuth server", () => {
      const clients = new Map([["postgres", makeConnectedClient("postgres")]]);
      const handler = makeHandler(clients, new Set());
      const service = new OAuthToolsService(handler as never);

      expect(service.getAuthTools()).toEqual([]);
    });

    it("does not return auth tool for connecting/failed states", () => {
      const clients = new Map<string, TargetClient>([
        [
          "svc-a",
          {
            _state: "connecting",
            targetServer: { name: "svc-a", type: "streamable-http", url: "" },
          },
        ],
        [
          "svc-b",
          {
            _state: "connection-failed",
            targetServer: { name: "svc-b", type: "streamable-http", url: "" },
            error: new Error(),
          },
        ],
      ]);
      const handler = makeHandler(clients, new Set());
      const service = new OAuthToolsService(handler as never);

      expect(service.getAuthTools()).toEqual([]);
    });

    it("handles mixed clients: returns tools only for pending-auth and connected-OAuth", () => {
      const clients = new Map<string, TargetClient>([
        ["github", makePendingAuthClient("github")], // pending-auth → include
        ["slack", makeConnectedClient("slack")], // connected + OAuth → include
        ["postgres", makeConnectedClient("postgres")], // connected, no OAuth → exclude
      ]);
      const handler = makeHandler(clients, new Set(["slack"]));
      const service = new OAuthToolsService(handler as never);

      const tools = service.getAuthTools();
      expect(tools).toHaveLength(2);
      const names = tools.map((t) => t.name);
      expect(names).toContain(`github__${AUTH_TOOL_NAME}`);
      expect(names).toContain(`slack__${AUTH_TOOL_NAME}`);
    });
  });

  describe("handleAuthToolCall", () => {
    it("includes the authorizationUrl in the response", async () => {
      const result: InitiateOAuthResult = {
        authorizationUrl: "https://auth.example.com/authorize?state=abc",
        state: "abc",
      };
      const handler = makeHandler(new Map(), new Set(), result);
      const service = new OAuthToolsService(handler as never);

      const response = await service.handleAuthToolCall("github");

      const text = getResponseText(response);
      expect(text).toContain(result.authorizationUrl);
    });

    it("includes userCode when the result contains one", async () => {
      const result: InitiateOAuthResult = {
        authorizationUrl: "https://auth.example.com",
        state: "state-1",
        userCode: "ABCD-1234",
      };
      const handler = makeHandler(new Map(), new Set(), result);
      const service = new OAuthToolsService(handler as never);

      const response = await service.handleAuthToolCall("github");

      const text = getResponseText(response);
      expect(text).toContain("ABCD-1234");
    });

    it("omits userCode when not present", async () => {
      const result: InitiateOAuthResult = {
        authorizationUrl: "https://auth.example.com",
        state: "state-1",
      };
      const handler = makeHandler(new Map(), new Set(), result);
      const service = new OAuthToolsService(handler as never);

      const response = await service.handleAuthToolCall("github");

      const text = getResponseText(response);
      expect(text).not.toContain("User code");
      expect(text.trim()).toBe(result.authorizationUrl);
    });

    it("normalizes the server name before calling initiateOAuthForServer", async () => {
      let capturedName: string | undefined;
      const handler: MockUpstreamHandler = {
        clientsByService: new Map(),
        isOAuthServer: () => false,
        initiateOAuthForServer: async (name) => {
          capturedName = name;
          return { authorizationUrl: "https://auth.example.com", state: "s" };
        },
      };
      const service = new OAuthToolsService(handler as never);

      await service.handleAuthToolCall("  GitHub  ");

      expect(capturedName).toBe("github");
    });

    it("passes injected callbackUrl to initiateOAuthForServer", async () => {
      let capturedCallbackUrl: string | undefined;
      const handler: MockUpstreamHandler = {
        clientsByService: new Map(),
        isOAuthServer: () => false,
        initiateOAuthForServer: async (_name, callbackUrl) => {
          capturedCallbackUrl = callbackUrl;
          return { authorizationUrl: "https://auth.example.com", state: "s" };
        },
      };
      const service = new OAuthToolsService(
        handler as never,
        "https://mcpx.example.com",
      );

      await service.handleAuthToolCall("github");

      expect(capturedCallbackUrl).toBe("https://mcpx.example.com");
    });

    it("returns MCP error response for NotFoundError", async () => {
      const { NotFoundError } = await import("../errors.js");
      const handler: MockUpstreamHandler = {
        clientsByService: new Map(),
        isOAuthServer: () => false,
        initiateOAuthForServer: async () => {
          throw new NotFoundError("Server not found: unknown");
        },
      };
      const service = new OAuthToolsService(handler as never);

      const response = await service.handleAuthToolCall("unknown");

      expect(response.isError).toBe(true);
      expect(getResponseText(response)).toContain("Server not found");
    });

    it("returns MCP error response for NotAllowedError", async () => {
      const { NotAllowedError } = await import("../errors.js");
      const handler: MockUpstreamHandler = {
        clientsByService: new Map(),
        isOAuthServer: () => false,
        initiateOAuthForServer: async () => {
          throw new NotAllowedError("Server does not support OAuth");
        },
      };
      const service = new OAuthToolsService(handler as never);

      const response = await service.handleAuthToolCall("myserver");

      expect(response.isError).toBe(true);
      expect(getResponseText(response)).toContain("does not support OAuth");
    });

    it("re-throws unexpected errors", async () => {
      const handler: MockUpstreamHandler = {
        clientsByService: new Map(),
        isOAuthServer: () => false,
        initiateOAuthForServer: async () => {
          throw new Error("Unexpected internal error");
        },
      };
      const service = new OAuthToolsService(handler as never);

      await expect(service.handleAuthToolCall("github")).rejects.toThrow(
        "Unexpected internal error",
      );
    });
  });
});
