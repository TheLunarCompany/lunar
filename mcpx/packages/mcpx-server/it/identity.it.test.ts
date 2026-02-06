import { resetEnv } from "../src/env.js";
import { getTestHarness, TestHarness } from "./utils.js";

const MCPX_BASE_URL = "http://localhost:9000";

describe("GET /identity when ENABLE_STRICT_PERMISSIONS=true ", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    process.env["ENABLE_STRICT_PERMISSIONS"] = "true";
    resetEnv();
    harness = getTestHarness({ targetServers: [] });
    await harness.initialize("StreamableHTTP");
  });

  afterAll(async () => {
    delete process.env["ENABLE_STRICT_PERMISSIONS"];
    resetEnv();
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
      privileges: { hasAdminPrivileges: true, isAdmin: true },
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
      privileges: { hasAdminPrivileges: false, isAdmin: false },
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
      privileges: { hasAdminPrivileges: false, isAdmin: false },
    });
  });
});

describe("GET /identity when ENABLE_STRICT_PERMISSIONS=false ", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    process.env["ENABLE_STRICT_PERMISSIONS"] = "false";
    resetEnv();
    harness = getTestHarness({ targetServers: [] });
    await harness.initialize("StreamableHTTP");
  });

  afterAll(async () => {
    delete process.env["ENABLE_STRICT_PERMISSIONS"];
    resetEnv();
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
      privileges: { hasAdminPrivileges: true, isAdmin: true },
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
      privileges: { hasAdminPrivileges: true, isAdmin: false },
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
      privileges: { hasAdminPrivileges: true, isAdmin: false },
    });
  });
});
