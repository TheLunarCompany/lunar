import { resetEnv } from "../src/env.js";
import { getTestHarness, TestHarness } from "./utils.js";

const MCPX_BASE_URL = "http://localhost:9000";

describe("Admin Endpoints when permissions enabled", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    process.env["ENABLE_STRICT_PERMISSIONS"] = "true";
    resetEnv();
    harness = getTestHarness({ targetServers: [] });
    await harness.initialize("StreamableHTTP");
  });

  afterAll(async () => {
    await harness.shutdown();
    delete process.env["ENABLE_STRICT_PERMISSIONS"];
    resetEnv();
  });

  describe("GET /admin/strictness", () => {
    describe("when identity is admin", () => {
      beforeAll(() => {
        harness.emitIdentity({ entityType: "user", role: "admin" });
      });

      it("should return strictness state", async () => {
        const response = await fetch(`${MCPX_BASE_URL}/admin/strictness`);
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body).toEqual({
          isStrict: true,
          adminOverride: false,
          hasAdminPrivileges: true,
        });
      });
    });

    describe("when identity is member", () => {
      beforeAll(() => {
        harness.emitIdentity({ entityType: "user", role: "member" });
      });

      it("should return 401 Unauthorized", async () => {
        const response = await fetch(`${MCPX_BASE_URL}/admin/strictness`);
        expect(response.status).toBe(401);

        const body = await response.json();
        expect(body.error).toBe("Admin privileges required");
      });
    });

    describe("when identity is space", () => {
      beforeAll(() => {
        harness.emitIdentity({ entityType: "space" });
      });

      it("should return 401 Unauthorized", async () => {
        const response = await fetch(`${MCPX_BASE_URL}/admin/strictness`);
        expect(response.status).toBe(401);

        const body = await response.json();
        expect(body.error).toBe("Admin privileges required");
      });
    });
  });

  describe("POST /admin/strictness", () => {
    describe("when identity is admin", () => {
      beforeAll(() => {
        harness.emitIdentity({ entityType: "user", role: "admin" });
      });

      afterEach(() => {
        // Reset override after each test
        harness.services.catalogManager.setAdminStrictnessOverride(false);
      });

      it("should set strictness override to true and return updated state", async () => {
        const response = await fetch(`${MCPX_BASE_URL}/admin/strictness`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ override: true }),
        });

        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body).toEqual({
          isStrict: false,
          adminOverride: true,
          hasAdminPrivileges: true,
        });
      });

      it("should set strictness override to false and return updated state", async () => {
        // First set override to true
        harness.services.catalogManager.setAdminStrictnessOverride(true);

        const response = await fetch(`${MCPX_BASE_URL}/admin/strictness`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ override: false }),
        });

        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body).toEqual({
          isStrict: true, // Admin user = strict when no override
          adminOverride: false,
          hasAdminPrivileges: true,
        });
      });

      it("should return 400 for invalid request body", async () => {
        const response = await fetch(`${MCPX_BASE_URL}/admin/strictness`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ override: "not-a-boolean" }),
        });

        expect(response.status).toBe(400);

        const body = await response.json();
        expect(body.error).toBe("Invalid request");
      });
    });

    describe("when identity is member", () => {
      beforeAll(() => {
        harness.emitIdentity({ entityType: "user", role: "member" });
      });

      it("should return 401 Unauthorized", async () => {
        const response = await fetch(`${MCPX_BASE_URL}/admin/strictness`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ override: true }),
        });

        expect(response.status).toBe(401);

        const body = await response.json();
        expect(body.error).toBe("Admin access required");
      });
    });
  });
});

describe("when permissions are disabled", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    // Explicitly disable permissions (or rely on default)
    process.env["ENABLE_STRICT_PERMISSIONS"] = "false";
    resetEnv();
    harness = getTestHarness({ targetServers: [] });
    await harness.initialize("StreamableHTTP");
  });

  afterAll(async () => {
    await harness.shutdown();
    delete process.env["ENABLE_STRICT_PERMISSIONS"];
    resetEnv();
  });

  it("should allow all users to access admin endpoints", async () => {
    harness.emitIdentity({ entityType: "user", role: "member" });

    const response = await fetch(`${MCPX_BASE_URL}/admin/strictness`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      isStrict: false,
      adminOverride: true,
      hasAdminPrivileges: true,
    });
  });

  describe("when identity is member", () => {
    beforeAll(() => {
      harness.emitIdentity({ entityType: "user", role: "member" });
    });

    it("should return 401 Unauthorized", async () => {
      const response = await fetch(`${MCPX_BASE_URL}/admin/strictness`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ override: true }),
      });

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error).toBe("Admin access required");
    });
  });
});
