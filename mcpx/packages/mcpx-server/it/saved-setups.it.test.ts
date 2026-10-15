import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
  expect,
} from "@jest/globals";
import { getTestHarness, MCPX_BASE_URL, TestHarness } from "./utils.js";

describe("Saved Setups Endpoints", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = getTestHarness({ targetServers: [] });
    await harness.initialize("StreamableHTTP");
  });

  afterAll(async () => {
    await harness.shutdown();
  });

  beforeEach(() => {
    harness.mockHubServer.clearSavedSetups();
  });

  describe("POST /saved-setups", () => {
    it("should save current setup with description", async () => {
      const response = await fetch(`${MCPX_BASE_URL}/saved-setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "My test setup" }),
      });

      expect(response.status).toBe(201);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.savedSetupId).toBeDefined();
      expect(body.description).toBe("My test setup");
      expect(body.savedAt).toBeDefined();

      // Verify it was saved on the mock server
      const savedSetups = harness.mockHubServer.getSavedSetups();
      expect(savedSetups).toHaveLength(1);
      expect(savedSetups[0]?.description).toBe("My test setup");
    });

    it("should return 400 for missing description", async () => {
      const response = await fetch(`${MCPX_BASE_URL}/saved-setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });

    it("should accept exactly 200-character description", async () => {
      const desc200 = "a".repeat(200);
      const response = await fetch(`${MCPX_BASE_URL}/saved-setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc200 }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.description).toBe(desc200);
    });

    it("should reject 201-character description", async () => {
      const desc201 = "a".repeat(201);
      const response = await fetch(`${MCPX_BASE_URL}/saved-setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc201 }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.message).toBe("Invalid request schema");
      expect(JSON.stringify(body.error)).toContain("cannot exceed 200");
    });

    it("should reject empty description", async () => {
      const response = await fetch(`${MCPX_BASE_URL}/saved-setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "" }),
      });

      expect(response.status).toBe(400);
    });

    it("should reject whitespace-only description", async () => {
      const response = await fetch(`${MCPX_BASE_URL}/saved-setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "   \t  " }),
      });

      expect(response.status).toBe(400);
    });

    it("should reject description with disallowed character (@)", async () => {
      const response = await fetch(`${MCPX_BASE_URL}/saved-setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "user@example.com" }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.message).toBe("Invalid request schema");
      expect(JSON.stringify(body.error)).toContain("Invalid characters");
    });

    it("should reject description with emoji", async () => {
      const response = await fetch(`${MCPX_BASE_URL}/saved-setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "🚀 Production" }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.message).toBe("Invalid request schema");
      expect(JSON.stringify(body.error)).toContain("Invalid characters");
    });

    it("should accept description with allowed special characters", async () => {
      const descWithSpecial = "GitHub & Slack (prod), v1.0!";
      const response = await fetch(`${MCPX_BASE_URL}/saved-setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descWithSpecial }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.description).toBe(descWithSpecial);
    });

    it("should trim and accept description with leading/trailing whitespace", async () => {
      const descWithSpace = "  Valid Description  ";
      const response = await fetch(`${MCPX_BASE_URL}/saved-setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descWithSpace }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.description).toBe("Valid Description");
    });
  });

  describe("GET /saved-setups", () => {
    it("should return empty list when no setups saved", async () => {
      const response = await fetch(`${MCPX_BASE_URL}/saved-setups`);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.setups).toEqual([]);
    });

    it("should return list of saved setups", async () => {
      // Save two setups first
      await fetch(`${MCPX_BASE_URL}/saved-setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Setup 1" }),
      });
      await fetch(`${MCPX_BASE_URL}/saved-setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Setup 2" }),
      });

      const response = await fetch(`${MCPX_BASE_URL}/saved-setups`);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.setups).toHaveLength(2);
      expect(
        body.setups.map((s: { description: string }) => s.description),
      ).toContain("Setup 1");
      expect(
        body.setups.map((s: { description: string }) => s.description),
      ).toContain("Setup 2");
    });

    it("should return 500 when the hub fails to list", async () => {
      harness.mockHubServer.failListSavedSetups("db down");

      const response = await fetch(`${MCPX_BASE_URL}/saved-setups`);

      expect(response.status).toBe(500);
    });
  });

  describe("DELETE /saved-setups/:id", () => {
    it("should delete a saved setup", async () => {
      // Save a setup first
      const createResponse = await fetch(`${MCPX_BASE_URL}/saved-setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "To be deleted" }),
      });
      const { savedSetupId } = await createResponse.json();

      // Delete it
      const deleteResponse = await fetch(
        `${MCPX_BASE_URL}/saved-setups/${savedSetupId}`,
        {
          method: "DELETE",
        },
      );

      expect(deleteResponse.status).toBe(200);

      const body = await deleteResponse.json();
      expect(body.message).toBe("Saved setup deleted successfully");

      // Verify it's gone
      const listResponse = await fetch(`${MCPX_BASE_URL}/saved-setups`);
      const listBody = await listResponse.json();
      expect(listBody.setups).toHaveLength(0);
    });

    it("should return 404 for non-existent setup", async () => {
      const response = await fetch(
        `${MCPX_BASE_URL}/saved-setups/00000000-0000-0000-0000-000000000000`,
        {
          method: "DELETE",
        },
      );

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /saved-setups/:id", () => {
    it("should update a saved setup with current config", async () => {
      // Save a setup first
      const createResponse = await fetch(`${MCPX_BASE_URL}/saved-setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Original setup" }),
      });
      const { savedSetupId, savedAt: originalSavedAt } =
        await createResponse.json();

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update it
      const updateResponse = await fetch(
        `${MCPX_BASE_URL}/saved-setups/${savedSetupId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
        },
      );

      expect(updateResponse.status).toBe(200);

      const body = await updateResponse.json();
      expect(body.message).toBe("Saved setup updated successfully");

      // Verify it was updated (check the savedAt changed)
      const savedSetups = harness.mockHubServer.getSavedSetups();
      expect(savedSetups).toHaveLength(1);
      expect(savedSetups[0]?.savedAt).not.toBe(originalSavedAt);
    });

    it("should return 404 for non-existent setup", async () => {
      const response = await fetch(
        `${MCPX_BASE_URL}/saved-setups/00000000-0000-0000-0000-000000000000`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
        },
      );

      expect(response.status).toBe(404);
    });
  });

  describe("POST /saved-setups/:id/restore", () => {
    it("should restore a saved setup", async () => {
      // Save a setup first
      const createResponse = await fetch(`${MCPX_BASE_URL}/saved-setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Setup to restore" }),
      });
      const { savedSetupId } = await createResponse.json();

      // Restore it
      const restoreResponse = await fetch(
        `${MCPX_BASE_URL}/saved-setups/${savedSetupId}/restore`,
        {
          method: "POST",
        },
      );

      expect(restoreResponse.status).toBe(200);

      const body = await restoreResponse.json();
      expect(body.message).toBe("Setup restored successfully");
    });

    it("should return 404 for non-existent setup", async () => {
      const response = await fetch(
        `${MCPX_BASE_URL}/saved-setups/00000000-0000-0000-0000-000000000000/restore`,
        {
          method: "POST",
        },
      );

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.message).toBe("Saved setup not found");
    });

    it("should return 500 when the hub fails to list", async () => {
      const createResponse = await fetch(`${MCPX_BASE_URL}/saved-setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Setup to restore" }),
      });
      const { savedSetupId } = await createResponse.json();
      harness.mockHubServer.failListSavedSetups("db down");

      const response = await fetch(
        `${MCPX_BASE_URL}/saved-setups/${savedSetupId}/restore`,
        { method: "POST" },
      );

      // A failed listing must not read as "Saved setup not found".
      expect(response.status).toBe(500);
    });
  });
});
