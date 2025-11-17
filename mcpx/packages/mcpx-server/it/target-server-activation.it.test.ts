import { parse } from "yaml";
import { getTestHarness, stdioTargetServers } from "./utils.js";

const MCPX_BASE_URL = "http://localhost:9000";

async function patchAppConfig(config: unknown): Promise<void> {
  await fetch(`${MCPX_BASE_URL}/app-config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

describe("Target Server Activation", () => {
  const harness = getTestHarness({ targetServers: [] });
  let initialConfig: { yaml: string; version: number; lastModified: string };

  beforeAll(async () => {
    await harness.initialize("SSE");

    const response = await fetch(`${MCPX_BASE_URL}/app-config`);
    initialConfig = await response.json();
  });

  beforeEach(async () => {
    const config = parse(initialConfig.yaml);
    await patchAppConfig({
      ...config,
      targetServerAttributes: {},
    });
  });

  afterAll(async () => {
    const config = parse(initialConfig.yaml);
    await patchAppConfig(config);

    await harness.shutdown();
  });

  it("activates a target server", async () => {
    const serverName = "test-server";

    const activateResponse = await fetch(
      `${MCPX_BASE_URL}/target-server/${serverName}/activate`,
      { method: "PUT" },
    );
    expect(activateResponse.status).toBe(200);

    const attributesResponse = await fetch(
      `${MCPX_BASE_URL}/target-servers/attributes`,
    );
    expect(attributesResponse.status).toBe(200);

    const { targetServerAttributes } = await attributesResponse.json();
    expect(targetServerAttributes[serverName]).toEqual({ inactive: false });
  });

  it("deactivates a target server", async () => {
    const serverName = "test-server-2";

    const deactivateResponse = await fetch(
      `${MCPX_BASE_URL}/target-server/${serverName}/deactivate`,
      { method: "PUT" },
    );
    expect(deactivateResponse.status).toBe(200);

    const attributesResponse = await fetch(
      `${MCPX_BASE_URL}/target-servers/attributes`,
    );
    expect(attributesResponse.status).toBe(200);

    const { targetServerAttributes } = await attributesResponse.json();
    expect(targetServerAttributes[serverName]).toEqual({ inactive: true });
  });

  it("toggles activation state", async () => {
    const serverName = "toggle-server";

    await fetch(`${MCPX_BASE_URL}/target-server/${serverName}/activate`, {
      method: "PUT",
    });

    let attributesResponse = await fetch(
      `${MCPX_BASE_URL}/target-servers/attributes`,
    );
    let { targetServerAttributes } = await attributesResponse.json();
    expect(targetServerAttributes[serverName]).toEqual({ inactive: false });

    await fetch(`${MCPX_BASE_URL}/target-server/${serverName}/deactivate`, {
      method: "PUT",
    });

    attributesResponse = await fetch(
      `${MCPX_BASE_URL}/target-servers/attributes`,
    );
    ({ targetServerAttributes } = await attributesResponse.json());
    expect(targetServerAttributes[serverName]).toEqual({ inactive: true });

    await fetch(`${MCPX_BASE_URL}/target-server/${serverName}/activate`, {
      method: "PUT",
    });

    attributesResponse = await fetch(
      `${MCPX_BASE_URL}/target-servers/attributes`,
    );
    ({ targetServerAttributes } = await attributesResponse.json());
    expect(targetServerAttributes[serverName]).toEqual({ inactive: false });
  });

  it("normalizes server names (trim and lowercase)", async () => {
    const serverName = "  MixedCase-SERVER  ";
    const normalizedName = "mixedcase-server";

    await fetch(`${MCPX_BASE_URL}/target-server/${serverName}/activate`, {
      method: "PUT",
    });

    const attributesResponse = await fetch(
      `${MCPX_BASE_URL}/target-servers/attributes`,
    );
    const { targetServerAttributes } = await attributesResponse.json();

    expect(targetServerAttributes[normalizedName]).toEqual({
      inactive: false,
    });
    expect(targetServerAttributes[serverName]).toBeUndefined();
  });

  it("preserves existing attributes when toggling state", async () => {
    const serverName = "server-with-attrs";

    await fetch(`${MCPX_BASE_URL}/target-server/${serverName}/activate`, {
      method: "PUT",
    });

    let attributesResponse = await fetch(
      `${MCPX_BASE_URL}/target-servers/attributes`,
    );
    let { targetServerAttributes } = await attributesResponse.json();
    const initialAttributes = targetServerAttributes[serverName];

    await fetch(`${MCPX_BASE_URL}/target-server/${serverName}/deactivate`, {
      method: "PUT",
    });

    attributesResponse = await fetch(
      `${MCPX_BASE_URL}/target-servers/attributes`,
    );
    ({ targetServerAttributes } = await attributesResponse.json());

    expect(targetServerAttributes[serverName]).toEqual({
      ...initialAttributes,
      inactive: true,
    });
  });

  it("returns 400 when server name is missing", async () => {
    const activateResponse = await fetch(
      `${MCPX_BASE_URL}/target-server//activate`,
      { method: "PUT" },
    );
    expect(activateResponse.status).toBe(404);

    const deactivateResponse = await fetch(
      `${MCPX_BASE_URL}/target-server//deactivate`,
      { method: "PUT" },
    );
    expect(deactivateResponse.status).toBe(404);
  });

  it("retrieves empty attributes when no servers configured", async () => {
    const attributesResponse = await fetch(
      `${MCPX_BASE_URL}/target-servers/attributes`,
    );
    expect(attributesResponse.status).toBe(200);

    const { targetServerAttributes } = await attributesResponse.json();
    expect(Object.keys(targetServerAttributes).length).toBe(0);
  });

  it("persists attributes across multiple operations", async () => {
    const server1 = "persist-server-1";
    const server2 = "persist-server-2";

    await fetch(`${MCPX_BASE_URL}/target-server/${server1}/activate`, {
      method: "PUT",
    });
    await fetch(`${MCPX_BASE_URL}/target-server/${server2}/deactivate`, {
      method: "PUT",
    });

    const attributesResponse = await fetch(
      `${MCPX_BASE_URL}/target-servers/attributes`,
    );
    const { targetServerAttributes } = await attributesResponse.json();

    expect(targetServerAttributes[server1]).toEqual({ inactive: false });
    expect(targetServerAttributes[server2]).toEqual({ inactive: true });
  });

  describe("idempotency", () => {
    it("handles activating twice in a row", async () => {
      const serverName = "double-activate";

      const firstActivate = await fetch(
        `${MCPX_BASE_URL}/target-server/${serverName}/activate`,
        { method: "PUT" },
      );
      expect(firstActivate.status).toBe(200);

      const secondActivate = await fetch(
        `${MCPX_BASE_URL}/target-server/${serverName}/activate`,
        { method: "PUT" },
      );
      expect(secondActivate.status).toBe(200);

      const attributesResponse = await fetch(
        `${MCPX_BASE_URL}/target-servers/attributes`,
      );
      const { targetServerAttributes } = await attributesResponse.json();
      expect(targetServerAttributes[serverName]).toEqual({ inactive: false });
    });

    it("handles deactivating twice in a row", async () => {
      const serverName = "double-deactivate";

      const firstDeactivate = await fetch(
        `${MCPX_BASE_URL}/target-server/${serverName}/deactivate`,
        { method: "PUT" },
      );
      expect(firstDeactivate.status).toBe(200);

      const secondDeactivate = await fetch(
        `${MCPX_BASE_URL}/target-server/${serverName}/deactivate`,
        { method: "PUT" },
      );
      expect(secondDeactivate.status).toBe(200);

      const attributesResponse = await fetch(
        `${MCPX_BASE_URL}/target-servers/attributes`,
      );
      const { targetServerAttributes } = await attributesResponse.json();
      expect(targetServerAttributes[serverName]).toEqual({ inactive: true });
    });
  });

  describe("tool filtering behavior", () => {
    beforeAll(async () => {
      await Promise.all(
        stdioTargetServers.map((server) =>
          fetch(`${MCPX_BASE_URL}/target-server`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(server),
          }),
        ),
      );
    });

    afterAll(async () => {
      await Promise.all(
        stdioTargetServers.map((server) =>
          fetch(`${MCPX_BASE_URL}/target-server/${server.name}`, {
            method: "DELETE",
          }),
        ),
      );
    });

    it("excludes tools from inactive servers in list_tools", async () => {
      const initialTools = await harness.client.listTools();
      const echoTools = initialTools.tools.filter((t) =>
        t.name.startsWith("echo-service__"),
      );
      expect(echoTools.length).toBeGreaterThan(0);

      await fetch(`${MCPX_BASE_URL}/target-server/echo-service/deactivate`, {
        method: "PUT",
      });

      const toolsAfterDeactivate = await harness.client.listTools();
      const echoToolsAfterDeactivate = toolsAfterDeactivate.tools.filter((t) =>
        t.name.startsWith("echo-service__"),
      );
      expect(echoToolsAfterDeactivate).toHaveLength(0);

      await fetch(`${MCPX_BASE_URL}/target-server/echo-service/activate`, {
        method: "PUT",
      });

      const toolsAfterReactivate = await harness.client.listTools();
      const echoToolsAfterReactivate = toolsAfterReactivate.tools.filter((t) =>
        t.name.startsWith("echo-service__"),
      );
      expect(echoToolsAfterReactivate.length).toBe(echoTools.length);
    });

    it("blocks tool calls to inactive servers", async () => {
      const result = await harness.client.callTool({
        name: "echo-service__echo",
        arguments: { message: "test" },
      });
      expect(result.content).toBeDefined();

      await fetch(`${MCPX_BASE_URL}/target-server/echo-service/deactivate`, {
        method: "PUT",
      });

      await expect(
        harness.client.callTool({
          name: "echo-service__echo",
          arguments: { message: "test" },
        }),
      ).rejects.toThrow(/inactive/i);

      await fetch(`${MCPX_BASE_URL}/target-server/echo-service/activate`, {
        method: "PUT",
      });

      const resultAfterReactivate = await harness.client.callTool({
        name: "echo-service__echo",
        arguments: { message: "test" },
      });
      expect(resultAfterReactivate.content).toBeDefined();
    });

    it("does not affect other servers when one is deactivated", async () => {
      await fetch(`${MCPX_BASE_URL}/target-server/echo-service/deactivate`, {
        method: "PUT",
      });

      const result = await harness.client.callTool({
        name: "calculator-service__add",
        arguments: { a: 2, b: 3 },
      });
      expect(result.content).toBeDefined();

      const tools = await harness.client.listTools();
      const calculatorTools = tools.tools.filter((t) =>
        t.name.startsWith("calculator-service__"),
      );
      expect(calculatorTools.length).toBeGreaterThan(0);
    });
  });

  describe("cleanup on removal", () => {
    it("removes deleted server attributes and preserves others", async () => {
      const server1 = "removal-test-1";
      const server2 = "removal-test-2";
      const echoServer = stdioTargetServers[0];
      const calculatorServer = stdioTargetServers[1];

      const targetServer1 = { ...echoServer, name: server1 };
      await fetch(`${MCPX_BASE_URL}/target-server`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targetServer1),
      });

      const targetServer2 = { ...calculatorServer, name: server2 };
      await fetch(`${MCPX_BASE_URL}/target-server`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targetServer2),
      });

      await fetch(`${MCPX_BASE_URL}/target-server/${server1}/deactivate`, {
        method: "PUT",
      });
      await fetch(`${MCPX_BASE_URL}/target-server/${server2}/deactivate`, {
        method: "PUT",
      });

      let attributesResponse = await fetch(
        `${MCPX_BASE_URL}/target-servers/attributes`,
      );
      let { targetServerAttributes } = await attributesResponse.json();
      expect(targetServerAttributes[server1]).toEqual({ inactive: true });
      expect(targetServerAttributes[server2]).toEqual({ inactive: true });

      const deleteResponse = await fetch(
        `${MCPX_BASE_URL}/target-server/${server1}`,
        { method: "DELETE" },
      );
      expect(deleteResponse.status).toBe(200);

      attributesResponse = await fetch(
        `${MCPX_BASE_URL}/target-servers/attributes`,
      );
      ({ targetServerAttributes } = await attributesResponse.json());
      expect(targetServerAttributes[server1]).toBeUndefined();
      expect(targetServerAttributes[server2]).toEqual({ inactive: true });

      await fetch(`${MCPX_BASE_URL}/target-server/${server2}`, {
        method: "DELETE",
      });
    });
  });
});
