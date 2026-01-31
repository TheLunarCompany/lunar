import { getTestHarness, TestHarness } from "./utils.js";

const MCPX_BASE_URL = "http://localhost:9000";

describe("GET /identity", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = getTestHarness({ targetServers: [] });
    await harness.initialize("StreamableHTTP");
  });

  afterAll(async () => {
    await harness.shutdown();
  });

  it("should return identity for admin user", async () => {
    harness.emitIdentity({ entityType: "user", role: "admin" });

    const response = await fetch(`${MCPX_BASE_URL}/identity`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.identity).toEqual({
      mode: "enterprise",
      entity: { entityType: "user", role: "admin" },
    });
  });

  it("should return identity for member user", async () => {
    harness.emitIdentity({ entityType: "user", role: "member" });

    const response = await fetch(`${MCPX_BASE_URL}/identity`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.identity).toEqual({
      mode: "enterprise",
      entity: { entityType: "user", role: "member" },
    });
  });

  it("should return identity for space", async () => {
    harness.emitIdentity({ entityType: "space" });

    const response = await fetch(`${MCPX_BASE_URL}/identity`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.identity).toEqual({
      mode: "enterprise",
      entity: { entityType: "space" },
    });
  });
});
