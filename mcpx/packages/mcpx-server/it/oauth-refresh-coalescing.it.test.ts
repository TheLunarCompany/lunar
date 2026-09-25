// The story:
// - We build a fake OAuth world: an AS with 2s tokens, an MCP server (RS)
//   (startMockOAuthServers).
// - The AS is strict: use a refresh token twice and the whole login dies
//   (exchangeRefreshToken).
// - MCPX logs in once, no browser (logIn).
// - Each round, we let the token die and fire 8 calls at once: all hit 401
//   (expireThenCallConcurrently).
// - Test 1, two rounds: every call works, one refresh per round.
// - Test 2, the AS hiccups with a 503: MCPX comes back, next round is clean
//   (failNextTokenRequest).
// - All of it runs twice: an AS that rotates (new refresh token each time,
//   Okta) and one that doesn't (same refresh token forever, Google).

import { withAsyncPolling } from "@mcpx/toolkit-core/time";
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
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { resetEnv } from "../src/env.js";
import { TargetServer } from "../src/model/target-servers.js";
import { getTestHarness, MCPX_BASE_URL, TestHarness } from "./utils.js";

const SERVER_NAME = "oauth-protected-mcp";
const ACCESS_TOKEN_TTL_MS = 2000;
const CONCURRENT_CALLS = 8;

interface RefreshCounts {
  ok: number;
  reused: number;
  unknown: number;
  failed: number;
}

interface MockOAuthServers {
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
async function startMockOAuthServers(props: {
  rotate: boolean;
}): Promise<MockOAuthServers> {
  const { rotate } = props;
  const refreshes: RefreshCounts = { ok: 0, reused: 0, unknown: 0, failed: 0 };
  const failures = { pending: 0 };
  const clients = new Map<string, OAuthClientInformationFull>();
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
      expiresAtMs: Date.now() + ACCESS_TOKEN_TTL_MS,
    });
    refreshTokens.set(refreshToken, { family, used: false });
    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: ACCESS_TOKEN_TTL_MS / 1000,
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
      const mcp = new McpServer({ name: SERVER_NAME, version: "1.0.0" });
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
async function logIn(harness: TestHarness): Promise<void> {
  const { upstreamHandler } = harness.services;
  const { authorizationUrl } =
    await upstreamHandler.initiateOAuthForServer(SERVER_NAME);
  const redirect = await fetch(authorizationUrl, { redirect: "manual" });
  const callback = new URL(redirect.headers.get("location") ?? "");
  const code = callback.searchParams.get("code");
  const state = callback.searchParams.get("state");
  if (!code || !state) throw new Error(`No code in ${callback}`);
  await upstreamHandler.completeOAuthByState(state, code);
}

async function readServerStateType(): Promise<string | undefined> {
  const response = await fetch(`${MCPX_BASE_URL}/system-state`);
  const systemState = await response.json();
  const server = systemState.targetServers.find(
    (s: { name: string }) => s.name === SERVER_NAME,
  );
  return server?.state?.type;
}

function waitForConnected(): Promise<string | undefined> {
  return withAsyncPolling({
    maxAttempts: 30,
    sleepTimeMs: 100,
    getValue: readServerStateType,
    found: (state): state is "connected" => state === "connected",
  });
}

async function waitFor(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// Distinct arguments per call so the tool-call cache cannot answer for the upstream.
async function callToolConcurrently(props: {
  harness: TestHarness;
  round: number;
}): Promise<boolean[]> {
  const { harness, round } = props;
  return Promise.all(
    Array.from({ length: CONCURRENT_CALLS }, (_, i) =>
      harness.client
        .callTool({
          name: `${SERVER_NAME}__whoami`,
          arguments: { n: round * 100 + i },
        })
        .then(
          (result) => result.isError === true,
          () => true,
        ),
    ),
  );
}

// Waits out the access token, then fires the burst, so every call lands on an expired token.
async function expireThenCallConcurrently(props: {
  harness: TestHarness;
  round: number;
}): Promise<boolean[]> {
  await waitFor(ACCESS_TOKEN_TTL_MS + 300);
  return callToolConcurrently(props);
}

describe.each([
  { kind: "rotating", rotate: true },
  { kind: "non-rotating", rotate: false },
])("Concurrent OAuth token refresh against a $kind AS", ({ rotate }) => {
  const holder: { harness?: TestHarness; oauthServers?: MockOAuthServers } = {};
  const noErrors = Array(CONCURRENT_CALLS).fill(false);

  beforeAll(async () => {
    const oauthServers = await startMockOAuthServers({ rotate });
    // Pings would refresh too and blur the per-expiry refresh count.
    process.env["UPSTREAM_PING_INTERVAL_MS"] = "0";
    resetEnv();

    const targetServer: TargetServer = {
      type: "streamable-http",
      name: SERVER_NAME,
      url: oauthServers.resourceServerUrl,
    };
    const harness = getTestHarness({
      targetServers: [targetServer],
      catalogItems: [
        {
          id: uuidv7(),
          name: SERVER_NAME,
          displayName: SERVER_NAME,
          config: {
            type: "streamable-http",
            url: oauthServers.resourceServerUrl,
          },
        },
      ],
    });
    await harness.initialize("StreamableHTTP");
    await logIn(harness);
    holder.harness = harness;
    holder.oauthServers = oauthServers;
  });

  afterAll(async () => {
    await holder.harness?.shutdown();
    await holder.oauthServers?.stop();
    delete process.env["UPSTREAM_PING_INTERVAL_MS"];
    resetEnv();
  });

  it("refreshes once per expiry and stays connected when concurrent calls hit an expired token", async () => {
    const { harness, oauthServers } = holder;
    if (!harness || !oauthServers) throw new Error("harness not initialized");

    expect(await waitForConnected()).toBe("connected");
    expect(oauthServers.refreshes).toEqual({
      ok: 0,
      reused: 0,
      unknown: 0,
      failed: 0,
    });

    // Two expiries: the second proves the next refresh really goes out, rotated or not.
    for (const round of [1, 2]) {
      const errors = await expireThenCallConcurrently({ harness, round });

      expect(errors).toEqual(noErrors);
      expect(oauthServers.refreshes).toEqual({
        ok: round,
        reused: 0,
        unknown: 0,
        failed: 0,
      });
      expect(await readServerStateType()).toBe("connected");
    }
  }, 30_000);

  it("recovers from a transient 503 on the token endpoint instead of replaying it", async () => {
    const { harness, oauthServers } = holder;
    if (!harness || !oauthServers) throw new Error("harness not initialized");
    const before = { ...oauthServers.refreshes };

    oauthServers.failNextTokenRequest();
    // Calls in flight when silent re-auth swaps the client may fail; the server must come back.
    await expireThenCallConcurrently({ harness, round: 3 });
    expect(await waitForConnected()).toBe("connected");

    const errors = await expireThenCallConcurrently({ harness, round: 4 });

    expect(errors).toEqual(noErrors);
    expect(oauthServers.refreshes).toEqual({
      ...before,
      ok: before.ok + 2,
      failed: 1,
    });
    expect(await readServerStateType()).toBe("connected");
  }, 30_000);
});
