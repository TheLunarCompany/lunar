import { wrapInEnvelope } from "@mcpx/webapp-protocol/messages";
import { backendDefaultServers } from "../src/server/constants-servers.js";
import { resetEnv } from "../src/env.js";
import {
  getTestHarness,
  stdioTargetServers,
  echoTargetServer,
  calculatorTargetServer,
} from "./utils.js";
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
  describe("non-enterprise mode (no Hub)", () => {
    let originalInstanceKey: string | undefined;
    let harness: ReturnType<typeof getTestHarness>;

    beforeAll(async () => {
      originalInstanceKey = process.env["INSTANCE_KEY"];
      delete process.env["INSTANCE_KEY"];
      resetEnv();

      harness = getTestHarness();
      await harness.initialize("StreamableHTTP");
    });

    afterAll(async () => {
      await harness.shutdown();

      if (originalInstanceKey !== undefined) {
        process.env["INSTANCE_KEY"] = originalInstanceKey;
      }
      resetEnv();
    });

    it("returns backendDefaultServers when not in enterprise mode", async () => {
      const response = await getCatalogServers();
      expect(response.status).toBe(200);

      const catalogRes = await response.json();
      checkReturnedCatalog(catalogRes, backendDefaultServers);
    });
  });

  describe("enterprise mode (with Hub)", () => {
    const harness = getTestHarness();

    beforeAll(async () => {
      await harness.initialize("StreamableHTTP");
    });

    afterAll(async () => {
      await harness.shutdown();
    });

    it("returns initial catalog from Hub after connection", async () => {
      const response = await getCatalogServers();
      expect(response.status).toBe(200);

      const catalogRes = await response.json();
      // Hub sends stdioTargetServers (echo-service, calculator-service)
      const expectedServers = stdioTargetServers.map(({ name, ...config }) => ({
        name,
        displayName: name,
        config,
      }));
      checkReturnedCatalog(catalogRes, expectedServers);
    });

    it("updates catalog when Hub sends new set-catalog", async () => {
      const mockHubServerList: CatalogMCPServerList = [
        {
          name: "test-server",
          displayName: "Testing",
          description:
            "If you're seeing this server in the catalog it means the test has passed",
          config: {
            type: "streamable-http",
            url: "https://test-url/mcp-server/mcp",
          },
        },
      ];

      const payload = {
        items: mockHubServerList.map((server) => ({ server })),
      };

      const envelope = wrapInEnvelope({ payload });

      const connectedClients = harness.mockHubServer.getConnectedClients();
      expect(connectedClients.length).toBeGreaterThan(0);
      const socketId = connectedClients[0];
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

  describe("server disconnection on catalog change", () => {
    async function getConnectedServerNames(): Promise<string[]> {
      const response = await fetch(`${MCPX_BASE_URL}/system-state`);
      const systemState = await response.json();
      return systemState.targetServers.map((s: { name: string }) => s.name);
    }

    function emitCatalogUpdate(
      harness: ReturnType<typeof getTestHarness>,
      serverNames: string[],
      isStrict: boolean,
    ): void {
      const payload = {
        items: serverNames.map((name) => ({
          server: {
            name,
            displayName: name,
            config: { type: "stdio", command: "node", args: [], env: {} },
          },
        })),
        isStrict,
      };
      const envelope = wrapInEnvelope({ payload });
      const socketId = harness.mockHubServer.getConnectedClients()[0];
      harness.mockHubServer.emitToClient(socketId!, "set-catalog", envelope);
    }

    describe("non-strict mode (admin/space)", () => {
      const harness = getTestHarness();

      beforeAll(async () => {
        await harness.initialize("StreamableHTTP");
      });

      afterAll(async () => {
        await harness.shutdown();
      });

      it("disconnects servers explicitly removed from catalog (even in non-strict mode)", async () => {
        // Verify both servers are connected initially
        const initialServers = await getConnectedServerNames();
        expect(initialServers).toContain(echoTargetServer.name);
        expect(initialServers).toContain(calculatorTargetServer.name);

        // Send catalog update that removes calculator-service, with isStrict: false (admin/space)
        emitCatalogUpdate(harness, [echoTargetServer.name], false);
        await new Promise((resolve) => setTimeout(resolve, 300));

        // calculator-service should be disconnected (explicitly removed from catalog)
        // echo-service should still be connected (still in catalog)
        const serversAfter = await getConnectedServerNames();
        expect(serversAfter).toContain(echoTargetServer.name);
        expect(serversAfter).not.toContain(calculatorTargetServer.name);
      });
    });

    describe("strict mode (member)", () => {
      const harness = getTestHarness();

      beforeAll(async () => {
        await harness.initialize("StreamableHTTP");
      });

      afterAll(async () => {
        await harness.shutdown();
      });

      it("disconnects servers when removed from catalog (members restricted to catalog)", async () => {
        // Verify both servers are connected initially
        const initialServers = await getConnectedServerNames();
        expect(initialServers).toContain(echoTargetServer.name);
        expect(initialServers).toContain(calculatorTargetServer.name);

        // Send catalog update that removes calculator-service, with isStrict: true (member)
        emitCatalogUpdate(harness, [echoTargetServer.name], true);
        await new Promise((resolve) => setTimeout(resolve, 300));

        // echo-service should still be connected (still in catalog)
        // calculator-service should be disconnected (removed from catalog in strict mode)
        const serversAfter = await getConnectedServerNames();
        expect(serversAfter).toContain(echoTargetServer.name);
        expect(serversAfter).not.toContain(calculatorTargetServer.name);
      });
    });
  });
});
