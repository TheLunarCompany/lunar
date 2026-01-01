import { wrapInEnvelope } from "@mcpx/webapp-protocol/messages";
import { backendDefaultServers } from "../src/server/constants-servers.js";
import { getTestHarness } from "./utils.js";
import { CatalogMCPServerItem, CatalogMCPServerList } from "@mcpx/shared-model";
const MCPX_BASE_URL = "http://localhost:9000";

async function getCatalogServers() {
  return await fetch(`${MCPX_BASE_URL}/catalog/mcp-servers`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
}

function checkReturnedCatalog(
  returnedCatalog: CatalogMCPServerItem[],
  expectedCatalog: CatalogMCPServerItem[],
) {
  expect(returnedCatalog).toHaveLength(expectedCatalog.length);
  if (returnedCatalog.length > 0) {
    expect(returnedCatalog.map((s) => s.name).sort()).toEqual(
      expectedCatalog.map((s) => s.name).sort(),
    );
  }
}

describe("set-catalog integration test", () => {
  const harness = getTestHarness();

  beforeAll(async () => {
    await harness.initialize("StreamableHTTP");
  });

  afterAll(async () => {
    await harness.shutdown();
  });

  it("no hub connection - expect to get the default servers", async () => {
    const response = await getCatalogServers();
    expect(response.status).toBe(200);

    const catalogRes = await response.json();
    checkReturnedCatalog(catalogRes, backendDefaultServers);
  });

  it("hub connection exists, expect to get our test servers", async () => {
    const mockHubServerList: CatalogMCPServerList = [
      {
        name: "test-server",
        displayName: "Testing",
        description:
          "If you're seeing this server in the catalog it means the test has passed",
        config: {
          "test-server": {
            type: "streamable-http",
            url: "https://test-url/mcp-server/mcp",
          },
        },
      },
    ];

    const payload = {
      items: mockHubServerList.map((server) => ({ server })),
    };

    const envelope = wrapInEnvelope(payload);

    const connectedClients = harness.mockHubServer.getConnectedClients();
    expect(connectedClients.length).toBeGreaterThan(0);
    const socketId = connectedClients[0]; // simply test the first client
    if (socketId) {
      harness.mockHubServer.emitToClient(socketId, "set-catalog", envelope);

      await new Promise((resolve) => setTimeout(resolve, 200));

      const response = await getCatalogServers();
      expect(response.status).toBe(200);
      const serversRes = await response.json();

      checkReturnedCatalog(serversRes, mockHubServerList);
    }
  });
});
