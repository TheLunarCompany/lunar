import { resetEnv } from "../src/env.js";
import { getTestHarness, TestHarness } from "./utils.js";

const MCPX_BASE_URL = "http://localhost:9000";

describe("Admin Endpoints when permissions enabled", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    process.env["STRICTNESS_REQUIRED"] = "true";
    resetEnv();
    harness = getTestHarness({ targetServers: [] });
    await harness.initialize("StreamableHTTP");
  });

  afterAll(async () => {
    await harness.shutdown();
    delete process.env["STRICTNESS_REQUIRED"];
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
          strictnessFeatureEnabled: true,
          isStrict: true,
          adminOverride: false,
        });
      });
    });

    describe("when identity is member", () => {
      beforeAll(() => {
        harness.emitIdentity({ entityType: "user", role: "member" });
      });

      it("should return strictness state for member too", async () => {
        const response = await fetch(`${MCPX_BASE_URL}/admin/strictness`);
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body).toEqual({
          strictnessFeatureEnabled: true,
          isStrict: true,
          adminOverride: false,
        });
      });
    });

    describe("when identity is space", () => {
      beforeAll(() => {
        harness.emitIdentity({ entityType: "space" });
      });

      it("should return strictness state for spaces too", async () => {
        const response = await fetch(`${MCPX_BASE_URL}/admin/strictness`);
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body).toEqual({
          strictnessFeatureEnabled: true,
          isStrict: false, // spaces are not strict when derives from identity
          adminOverride: false,
        });
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
          strictnessFeatureEnabled: true,
          isStrict: false,
          adminOverride: true,
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
          strictnessFeatureEnabled: true,
          isStrict: true,
          adminOverride: false,
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
    process.env["STRICTNESS_REQUIRED"] = "false";
    resetEnv();
    harness = getTestHarness({ targetServers: [] });
    await harness.initialize("StreamableHTTP");
  });

  afterAll(async () => {
    await harness.shutdown();
    delete process.env["STRICTNESS_REQUIRED"];
    resetEnv();
  });

  it("should allow all users to access admin GET endpoint", async () => {
    harness.emitIdentity({ entityType: "user", role: "member" });
    const response = await fetch(`${MCPX_BASE_URL}/admin/strictness`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      strictnessFeatureEnabled: false,
    });
  });

  it("should return 401 Unauthorized for member trying the POST endpoint", async () => {
    harness.emitIdentity({ entityType: "user", role: "member" });
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
