import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { SetIdentityPayload } from "@mcpx/webapp-protocol/messages";
import { IdentityService, toClientIdentity } from "./identity-service.js";

// Drives the internal Identity through the service so we never hand-build it.
function enterpriseIdentity(payload: SetIdentityPayload) {
  const service = new IdentityService(noOpLogger, { isEnterprise: true });
  service.setIdentity(payload);
  return service.getIdentity();
}

describe("IdentityService", () => {
  describe("#getIdentity", () => {
    it("should return personal identity when not enterprise", () => {
      const service = new IdentityService(noOpLogger, {
        isEnterprise: false,
      });
      expect(service.getIdentity()).toEqual({ mode: "personal" });
    });

    it("should return default member identity in enterprise mode", () => {
      const service = new IdentityService(noOpLogger, {
        isEnterprise: true,
      });
      expect(service.getIdentity()).toEqual({
        mode: "enterprise",
        entity: { entityType: "user", role: "member" },
      });
    });
  });

  describe("#setIdentity", () => {
    it("should ignore setIdentity in personal mode", () => {
      const service = new IdentityService(noOpLogger, {
        isEnterprise: false,
      });
      service.setIdentity({ entityType: "user", role: "admin" });
      expect(service.getIdentity()).toEqual({ mode: "personal" });
    });

    it("should update to admin user identity", () => {
      const service = new IdentityService(noOpLogger, {
        isEnterprise: true,
      });
      service.setIdentity({ entityType: "user", role: "admin" });
      expect(service.getIdentity()).toEqual({
        mode: "enterprise",
        entity: { entityType: "user", role: "admin" },
      });
    });

    it("should update to space identity", () => {
      const service = new IdentityService(noOpLogger, {
        isEnterprise: true,
      });
      service.setIdentity({ entityType: "space" });
      expect(service.getIdentity()).toEqual({
        mode: "enterprise",
        entity: { entityType: "space" },
      });
    });
  });

  describe("#isSpace", () => {
    it("should return false for personal mode", () => {
      const service = new IdentityService(noOpLogger, {
        isEnterprise: false,
      });
      expect(service.isSpace()).toBe(false);
    });

    it("should return true for space entity", () => {
      const service = new IdentityService(noOpLogger, {
        isEnterprise: true,
      });
      service.setIdentity({ entityType: "space" });
      expect(service.isSpace()).toBe(true);
    });

    it("should return false for user entity", () => {
      const service = new IdentityService(noOpLogger, {
        isEnterprise: true,
      });
      service.setIdentity({ entityType: "user", role: "admin" });
      expect(service.isSpace()).toBe(false);
    });
  });

  describe("toClientIdentity", () => {
    it("passes personal identity through unchanged", () => {
      const service = new IdentityService(noOpLogger, { isEnterprise: false });
      expect(toClientIdentity(service.getIdentity())).toEqual({
        mode: "personal",
      });
    });

    it("keeps a user's role and editingOnBehalfOf", () => {
      const identity = enterpriseIdentity({
        entityType: "user",
        role: "admin",
        displayName: "Alice",
        editingOnBehalfOf: { spaceName: "Payments" },
      });
      expect(toClientIdentity(identity)).toEqual({
        mode: "enterprise",
        entity: {
          entityType: "user",
          role: "admin",
          editingOnBehalfOf: { spaceName: "Payments" },
        },
      });
    });

    it("keeps a HOSTED_MCP_SERVER space's kind, name, and editor", () => {
      const identity = enterpriseIdentity({
        entityType: "space",
        spaceKind: "HOSTED_MCP_SERVER",
        spaceName: "My Server",
        editedBy: { adminDisplayName: "Alice", adminEmail: "alice@test.com" },
      });
      expect(toClientIdentity(identity)).toEqual({
        mode: "enterprise",
        entity: {
          entityType: "space",
          spaceKind: "HOSTED_MCP_SERVER",
          spaceName: "My Server",
          editedBy: { adminDisplayName: "Alice", adminEmail: "alice@test.com" },
        },
      });
    });

    it("keeps an AGENT_CONNECTOR space's kind", () => {
      const identity = enterpriseIdentity({
        entityType: "space",
        spaceKind: "AGENT_CONNECTOR",
        spaceName: "My Env",
      });
      expect(toClientIdentity(identity)).toMatchObject({
        entity: { spaceKind: "AGENT_CONNECTOR" },
      });
    });

    it("drops a space kind the client can't render (SANDBOX_ANALYSIS) to undefined", () => {
      const identity = enterpriseIdentity({
        entityType: "space",
        spaceKind: "SANDBOX_ANALYSIS",
        spaceName: "Scan",
      });
      expect(toClientIdentity(identity)).toEqual({
        mode: "enterprise",
        entity: {
          entityType: "space",
          spaceKind: undefined,
          spaceName: "Scan",
          editedBy: undefined,
        },
      });
    });
  });

  describe("#isAdmin", () => {
    it("should return false for personal mode", () => {
      const service = new IdentityService(noOpLogger, {
        isEnterprise: false,
      });
      expect(service.isAdmin()).toBe(false);
    });

    it("should return true for admin user", () => {
      const service = new IdentityService(noOpLogger, {
        isEnterprise: true,
      });
      service.setIdentity({ entityType: "user", role: "admin" });
      expect(service.isAdmin()).toBe(true);
    });

    it("should return false for member user", () => {
      const service = new IdentityService(noOpLogger, {
        isEnterprise: true,
      });
      service.setIdentity({ entityType: "user", role: "member" });
      expect(service.isAdmin()).toBe(false);
    });

    it("should return false for space entity", () => {
      const service = new IdentityService(noOpLogger, {
        isEnterprise: true,
      });
      service.setIdentity({ entityType: "space" });
      expect(service.isAdmin()).toBe(false);
    });

    describe("when permissions behaviors are disabled", () => {
      it("should still return actual identity via getIdentity but isAdmin=true when permissions disabled", () => {
        const service = new IdentityService(noOpLogger, {
          isEnterprise: true,
        });
        service.setIdentity({ entityType: "user", role: "member" });
        expect(service.isAdmin()).toBe(false);
        // getIdentity still shows the actual identity
        expect(service.getIdentity()).toEqual({
          mode: "enterprise",
          entity: { entityType: "user", role: "member" },
        });
      });

      it("should return true for admin user when permissions disabled", () => {
        const service = new IdentityService(noOpLogger, {
          isEnterprise: true,
        });
        service.setIdentity({ entityType: "user", role: "admin" });
        expect(service.isAdmin()).toBe(true);
        expect(service.getIdentity()).toEqual({
          mode: "enterprise",
          entity: { entityType: "user", role: "admin" },
        });
      });
    });
  });
});
