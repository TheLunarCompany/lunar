import { describe, it, expect, afterEach } from "@jest/globals";
import { v7 as uuidv7 } from "uuid";
import { TargetServer } from "../src/model/target-servers.js";
import { SetCatalogPayload } from "./mock-hub-server.js";
import {
  logIn,
  MockOAuthServers,
  readServerStateType,
  startMockOAuthServers,
  waitForConnected,
} from "./mock-oauth-servers.js";
import { getTestHarness, MCPX_BASE_URL, TestHarness } from "./utils.js";

const SERVER_NAME = "rate-limited-oauth-mcp";
const CALLBACK_URL = `${MCPX_BASE_URL}/oauth/callback`;

function buildCatalogPayload(props: {
  catalogItemId: string;
  url: string;
}): SetCatalogPayload {
  const { catalogItemId, url } = props;
  return {
    items: [
      {
        server: {
          id: catalogItemId,
          name: SERVER_NAME,
          displayName: SERVER_NAME,
          config: { type: "streamable-http", url },
        },
        adminConfig: {
          staticOauthConfig: {
            authMethod: "client_credentials",
            credentials: {
              clientId: { type: "literal", value: "static-client" },
              clientSecret: { type: "literal", value: "static-secret" },
            },
            scopes: [],
            tokenAuthMethod: "client_secret_post",
          },
        },
      },
    ],
  };
}

describe("a 429 on the stored-token connect of an OAuth server", () => {
  const holder: { harnesses: TestHarness[]; oauthServers?: MockOAuthServers } =
    { harnesses: [] };

  afterEach(async () => {
    await Promise.all(holder.harnesses.map((harness) => harness.shutdown()));
    holder.harnesses = [];
    await holder.oauthServers?.stop();
  });

  it("turns the server pending-auth instead of connection-failed", async () => {
    const oauthServers = await startMockOAuthServers({
      rotate: false,
      accessTokenTtlMs: 60_000,
      staticClients: [
        {
          client_id: "static-client",
          client_secret: "static-secret",
          redirect_uris: [CALLBACK_URL],
        },
      ],
    });
    holder.oauthServers = oauthServers;
    const catalogItemId = uuidv7();
    const targetServer: TargetServer = {
      type: "streamable-http",
      name: SERVER_NAME,
      url: oauthServers.resourceServerUrl,
      catalogItemId,
    };
    const catalogPayload = buildCatalogPayload({
      catalogItemId,
      url: oauthServers.resourceServerUrl,
    });

    const before = getTestHarness({ targetServers: [targetServer] });
    before.mockHubServer.setCatalogPayload(catalogPayload);
    holder.harnesses.push(before);
    await before.initialize("StreamableHTTP");
    await logIn({
      harness: before,
      serverName: SERVER_NAME,
      callbackUrl: CALLBACK_URL,
    });
    expect(await waitForConnected(SERVER_NAME)).toBe("connected");
    const storedTokens = before.mockHubServer.getOAuthTokens();
    await before.shutdown();
    holder.harnesses = [];

    oauthServers.setMcpFault({ status: 429, retryAfterSeconds: 60 });

    const after = getTestHarness({ targetServers: [targetServer] });
    after.mockHubServer.setCatalogPayload(catalogPayload);
    holder.harnesses.push(after);
    after.mockHubServer.seedOAuthTokens(storedTokens);
    await after.initialize("StreamableHTTP");

    const state = await readServerStateType(SERVER_NAME);
    expect(state).toBe("pending-auth");
    expect(after.mockHubServer.getOAuthTokens()).toEqual(storedTokens);
  }, 30_000);
});
