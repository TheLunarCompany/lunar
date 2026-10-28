import { withAsyncPolling } from "@aigw/core/time";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import {
  InvalidGrantError,
  InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  OAuthClientInformationFull,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import express from "express";
import { createServer } from "http";
import { AddressInfo } from "net";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { MCPX_BASE_URL, TestHarness } from "./utils.js";

export interface RefreshCounts {
  ok: number;
  reused: number;
  unknown: number;
  failed: number;
}

export interface MockOAuthServers {
  // The MCP server MCPX connects to, guarded by tokens from the authorization server.
  resourceServerUrl: string;
  // What the authorization server answered to each refresh grant.
  refreshes: RefreshCounts;
  // The next token request gets a load-balancer style 503, then service resumes.
  failNextTokenRequest: () => void;
  stop: () => Promise<void>;
}

function deleteFamily<T extends { family: string }>(props: {
  tokens: Map<string, T>;
  family: string;
}): void {
  const { tokens, family } = props;
  Array.from(tokens.entries())
    .filter(([, entry]) => entry.family === family)
    .forEach(([token]) => tokens.delete(token));
}

// OAuth authorization server (AS) and the MCP resource server (RS) it protects, in one process for convenience.
// rotate: the AS issues a new refresh token per refresh with reuse detection (auth-bff, Okta, Auth0); otherwise one token forever (Google).
// staticClients: pre-registered clients, as for admin-set static OAuth; others register through DCR.
export async function startMockOAuthServers(props: {
  rotate: boolean;
  accessTokenTtlMs: number;
  staticClients?: OAuthClientInformationFull[];
}): Promise<MockOAuthServers> {
  const { rotate, accessTokenTtlMs, staticClients = [] } = props;
  const refreshes: RefreshCounts = { ok: 0, reused: 0, unknown: 0, failed: 0 };
  const failures = { pending: 0 };
  const clients = new Map<string, OAuthClientInformationFull>(
    staticClients.map((client) => [client.client_id, client]),
  );
  const codeChallenges = new Map<string, string>();
  const accessTokens = new Map<
    string,
    { family: string; expiresAtMs: number }
  >();
  const refreshTokens = new Map<string, { family: string; used: boolean }>();

  const issue = (props: {
    family: string;
    keepRefreshToken?: string;
  }): OAuthTokens => {
    const { family, keepRefreshToken } = props;
    const accessToken = randomBytes(16).toString("hex");
    const refreshToken = keepRefreshToken ?? randomBytes(16).toString("hex");
    accessTokens.set(accessToken, {
      family,
      expiresAtMs: Date.now() + accessTokenTtlMs,
    });
    refreshTokens.set(refreshToken, { family, used: false });
    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: accessTokenTtlMs / 1000,
      refresh_token: refreshToken,
    };
  };

  const revokeFamily = (family: string): void => {
    deleteFamily({ tokens: refreshTokens, family });
    deleteFamily({ tokens: accessTokens, family });
  };

  const provider: OAuthServerProvider = {
    clientsStore: {
      getClient: (clientId) => clients.get(clientId),
      registerClient: (client) => {
        const registered = {
          ...client,
          client_id: randomUUID(),
          client_id_issued_at: Math.floor(Date.now() / 1000),
        };
        clients.set(registered.client_id, registered);
        return registered;
      },
    },
    authorize: async (_client, params, res) => {
      const code = randomBytes(16).toString("hex");
      codeChallenges.set(code, params.codeChallenge);
      const redirect = new URL(params.redirectUri);
      redirect.searchParams.set("code", code);
      if (params.state) redirect.searchParams.set("state", params.state);
      res.redirect(redirect.toString());
    },
    challengeForAuthorizationCode: async (_client, code) => {
      const challenge = codeChallenges.get(code);
      if (!challenge) throw new InvalidGrantError("unknown code");
      return challenge;
    },
    exchangeAuthorizationCode: async (_client, code) => {
      codeChallenges.delete(code);
      return issue({ family: randomUUID() });
    },
    exchangeRefreshToken: async (_client, refreshToken) => {
      const entry = refreshTokens.get(refreshToken);
      if (!entry) {
        refreshes.unknown += 1;
        throw new InvalidGrantError("unknown refresh token");
      }
      // Reuse means a stolen token to a rotating AS: the whole family dies.
      if (entry.used) {
        refreshes.reused += 1;
        revokeFamily(entry.family);
        throw new InvalidGrantError("refresh token reuse");
      }
      refreshes.ok += 1;
      if (!rotate) {
        return issue({ family: entry.family, keepRefreshToken: refreshToken });
      }
      entry.used = true;
      return issue({ family: entry.family });
    },
    verifyAccessToken: async (token) => {
      const entry = accessTokens.get(token);
      if (!entry) throw new InvalidTokenError("unknown access token");
      return {
        token,
        clientId: "mcpx",
        scopes: [],
        expiresAt: entry.expiresAtMs / 1000,
      };
    },
  };

  const app = express();
  const httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  const baseUrl = `http://localhost:${port}`;
  const resourceServerUrl = `${baseUrl}/mcp`;

  app.post("/token", (_req, res, next) => {
    if (failures.pending === 0) {
      next();
      return;
    }
    failures.pending -= 1;
    refreshes.failed += 1;
    res.status(503).send("Service Unavailable");
  });
  app.use(
    mcpAuthRouter({
      provider,
      issuerUrl: new URL(baseUrl),
      resourceServerUrl: new URL(resourceServerUrl),
      authorizationOptions: { rateLimit: false },
      tokenOptions: { rateLimit: false },
      clientRegistrationOptions: { rateLimit: false },
    }),
  );
  app.all(
    "/mcp",
    express.json(),
    requireBearerAuth({
      verifier: provider,
      resourceMetadataUrl: `${baseUrl}/.well-known/oauth-protected-resource/mcp`,
    }),
    async (req, res) => {
      const mcp = new McpServer({ name: "mock-oauth-mcp", version: "1.0.0" });
      mcp.registerTool(
        "whoami",
        { inputSchema: { n: z.number() } },
        async ({ n }) => ({ content: [{ type: "text", text: `call ${n}` }] }),
      );
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      res.on("close", () => void transport.close());
      await mcp.connect(transport);
      await transport.handleRequest(req, res, req.body);
    },
  );

  return {
    resourceServerUrl,
    refreshes,
    failNextTokenRequest: () => {
      failures.pending += 1;
    },
    stop: async () => {
      if (!httpServer.listening) return;
      httpServer.closeAllConnections();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

// The authorization server auto-approves, so its redirect carries the code MCPX's callback would receive.
export async function logIn(props: {
  harness: TestHarness;
  serverName: string;
  callbackUrl?: string;
}): Promise<void> {
  const { harness, serverName, callbackUrl } = props;
  const { upstreamHandler } = harness.services;
  const { authorizationUrl } = await upstreamHandler.initiateOAuthForServer(
    serverName,
    callbackUrl,
  );
  const redirect = await fetch(authorizationUrl, { redirect: "manual" });
  const callback = new URL(redirect.headers.get("location") ?? "");
  const code = callback.searchParams.get("code");
  const state = callback.searchParams.get("state");
  if (!code || !state) throw new Error(`No code in ${callback}`);
  await upstreamHandler.completeOAuthByState(state, code);
}

export async function readServerStateType(
  serverName: string,
): Promise<string | undefined> {
  const response = await fetch(`${MCPX_BASE_URL}/system-state`);
  const systemState = await response.json();
  const server = systemState.targetServers.find(
    (s: { name: string }) => s.name === serverName,
  );
  return server?.state?.type;
}

export function waitForConnected(
  serverName: string,
): Promise<string | undefined> {
  return withAsyncPolling({
    maxAttempts: 30,
    sleepTimeMs: 100,
    getValue: () => readServerStateType(serverName),
    found: (state): state is "connected" => state === "connected",
  });
}
