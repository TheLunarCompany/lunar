import { v7 as uuidv7 } from "uuid";
import { backendDefaultServers } from "../src/server/constants-servers.js";
import { resetEnv } from "../src/env.js";
import {
  getTestHarness,
  stdioCatalogItems,
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
      // Hub sends stdioCatalogItems (echo-service, calculator-service)
      checkReturnedCatalog(catalogRes, stdioCatalogItems);
    });

    it("updates catalog when Hub sends new set-catalog", async () => {
      const mockHubServerList: CatalogMCPServerList = [
        {
          id: uuidv7(),
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

      harness.emitCatalog({
        items: mockHubServerList.map((server) => ({ server })),
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const response = await getCatalogServers();
      expect(response.status).toBe(200);
      const serversRes = await response.json();

      checkReturnedCatalog(serversRes, mockHubServerList);
    });
  });

  describe("server disconnection on catalog change", () => {
    async function getConnectedServerNames(): Promise<string[]> {
      const response = await fetch(`${MCPX_BASE_URL}/system-state`);
      const systemState = await response.json();
      return systemState.targetServers.map((s: { name: string }) => s.name);
    }

    function buildCatalogPayload(serverNames: string[]) {
      return {
        items: serverNames.map((name) => ({
          server: {
            id: uuidv7(),
            name,
            displayName: name,
            config: {
              type: "stdio" as const,
              command: "node" as const,
              args: [] as string[],
            },
          },
        })),
      };
    }

    describe("non-strict mode (space identity)", () => {
      const harness = getTestHarness();

      beforeAll(async () => {
        await harness.initialize("StreamableHTTP");
        // Switch to non-strict mode by setting space identity
        harness.emitIdentity({ entityType: "space" });
      });

      afterAll(async () => {
        await harness.shutdown();
      });

      it("disconnects servers explicitly removed from catalog (even in non-strict mode)", async () => {
        // Verify both servers are connected initially
        const initialServers = await getConnectedServerNames();
        expect(initialServers).toContain(echoTargetServer.name);
        expect(initialServers).toContain(calculatorTargetServer.name);

        // Send catalog update that removes calculator-service
        harness.emitCatalog(buildCatalogPayload([echoTargetServer.name]));
        await new Promise((resolve) => setTimeout(resolve, 300));

        // calculator-service should be disconnected (explicitly removed from catalog)
        // echo-service should still be connected (still in catalog)
        const serversAfter = await getConnectedServerNames();
        expect(serversAfter).toContain(echoTargetServer.name);
        expect(serversAfter).not.toContain(calculatorTargetServer.name);
      });
    });

    describe("strict mode (member identity)", () => {
      const harness = getTestHarness();

      beforeAll(async () => {
        await harness.initialize("StreamableHTTP");
        // Note: strict mode is default (mock hub sends user/member identity)
      });

      afterAll(async () => {
        await harness.shutdown();
      });

      it("disconnects servers when removed from catalog (members restricted to catalog)", async () => {
        // Verify both servers are connected initially
        const initialServers = await getConnectedServerNames();
        expect(initialServers).toContain(echoTargetServer.name);
        expect(initialServers).toContain(calculatorTargetServer.name);

        // Send catalog update that removes calculator-service
        harness.emitCatalog(buildCatalogPayload([echoTargetServer.name]));
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
