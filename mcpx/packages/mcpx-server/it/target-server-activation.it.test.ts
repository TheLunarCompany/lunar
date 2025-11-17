import { parse } from "yaml";
import { getTestHarness } from "./utils.js";

const MCPX_BASE_URL = "http://localhost:9000";

// A helper function to patch the app config
async function patchAppConfig(config: unknown): Promise<void> {
  await fetch(`${MCPX_BASE_URL}/app-config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

describe("Target Server Activation", () => {
  const harness = getTestHarness();
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
});
