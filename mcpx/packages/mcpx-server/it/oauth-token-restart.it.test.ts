// AIGW-255: after a pod restart, the first set-catalog was diffed against an
// empty catalog, so a catalog item with admin-set (static) OAuth looked
// "changed" and its tokens were deleted from the hub before the server
// reconnected. Restart = a fresh MCPX whose hub already holds the tokens.

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

const SERVER_NAME = "static-oauth-mcp";
const CALLBACK_URL = `${MCPX_BASE_URL}/oauth/callback`;
const CLIENT_ID = "static-client";
const CLIENT_SECRET = "static-secret";

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
              clientId: { type: "literal", value: CLIENT_ID },
              clientSecret: { type: "literal", value: CLIENT_SECRET },
            },
            scopes: [],
            tokenAuthMethod: "client_secret_post",
          },
        },
      },
    ],
  };
}

function startMcpx(props: {
  targetServer: TargetServer;
  catalogPayload: SetCatalogPayload;
}): TestHarness {
  const { targetServer, catalogPayload } = props;
  const harness = getTestHarness({ targetServers: [targetServer] });
  harness.mockHubServer.setCatalogPayload(catalogPayload);
  return harness;
}

describe("OAuth tokens of a static-OAuth catalog item across an MCPX restart", () => {
  const holder: {
    harnesses: TestHarness[];
    oauthServers?: MockOAuthServers;
  } = { harnesses: [] };

  afterEach(async () => {
    await Promise.all(holder.harnesses.map((harness) => harness.shutdown()));
    holder.harnesses = [];
    await holder.oauthServers?.stop();
  });

  it("reconnects with the stored tokens instead of asking to log in again", async () => {
    const oauthServers = await startMockOAuthServers({
      rotate: false,
      accessTokenTtlMs: 60_000,
      staticClients: [
        {
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
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

    const before = startMcpx({ targetServer, catalogPayload });
    holder.harnesses.push(before);
    await before.initialize("StreamableHTTP");
    await logIn({
      harness: before,
      serverName: SERVER_NAME,
      callbackUrl: CALLBACK_URL,
    });
    expect(await waitForConnected(SERVER_NAME)).toBe("connected");
    const storedTokens = before.mockHubServer.getOAuthTokens();
    expect(storedTokens.has(`${SERVER_NAME}:tokens`)).toBe(true);
    await before.shutdown();
    holder.harnesses = [];

    const after = startMcpx({ targetServer, catalogPayload });
    holder.harnesses.push(after);
    after.mockHubServer.seedOAuthTokens(storedTokens);
    await after.initialize("StreamableHTTP");

    expect(await readServerStateType(SERVER_NAME)).toBe("connected");
    const result = await after.client.callTool({
      name: `${SERVER_NAME}__whoami`,
      arguments: { n: 1 },
    });
    expect(result.content).toEqual([{ type: "text", text: "call 1" }]);
    expect(
      after.mockHubServer.getOAuthTokens().get(`${SERVER_NAME}:tokens`),
    ).toEqual(storedTokens.get(`${SERVER_NAME}:tokens`));
  }, 30_000);
});
