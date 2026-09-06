import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  BehaviorService,
  McpxBehavior,
  McpxBehaviorFeatureFlags,
  McpxBehaviorPolicies,
} from "./behavior-service.js";
import { noOpAuditLogService } from "./audit-log/audit-log-service.stub.js";
import { behaviorDefaults } from "./behavior-service.stub.js";

// ===================== Helpers ==========================
function createBehaviorService(
  initialOverrides: Partial<
    McpxBehaviorFeatureFlags & McpxBehaviorPolicies
  > = {},
): BehaviorService {
  const flat = { ...behaviorDefaults, ...initialOverrides };
  const initialValues: McpxBehavior = {
    featureFlags: {
      strictnessRequired: flat.strictnessRequired,
      enableResourceCapability: flat.enableResourceCapability,
      enablePromptCapability: flat.enablePromptCapability,
      enableSkillScoping: flat.enableSkillScoping,
    },
    policies: {
      logLevel: flat.logLevel,
      stdioServersEnabled: flat.stdioServersEnabled,
      dockerInDockerEnabled: flat.dockerInDockerEnabled,
    },
  };
  return new BehaviorService(noOpAuditLogService, initialValues, noOpLogger);
}

// ===================== Tests ==========================
describe("BehaviorService", () => {
  describe("get", () => {
    it("returns the initial value for a given setting", () => {
      const service = createBehaviorService({ stdioServersEnabled: false });

      expect(service.get("stdioServersEnabled")).toBe(false);
    });

    it("returns the updated value after applyBehaviorSettings", () => {
      const service = createBehaviorService({
        enableResourceCapability: false,
      });

      service.applyBehaviorSettings({
        newValues: {
          featureFlags: { enableResourceCapability: true },
          policies: { stdioServersEnabled: true, dockerInDockerEnabled: true },
        },
        timestamp: 1,
      });

      expect(service.get("enableResourceCapability")).toBe(true);
    });
  });

  describe("applyBehaviorSettings", () => {
    let behaviorService: BehaviorService;

    beforeEach(() => {
      behaviorService = createBehaviorService();
    });

    it("applies hub values over the initial values", () => {
      const applied = behaviorService.applyBehaviorSettings({
        newValues: {
          featureFlags: { enableResourceCapability: false },
          policies: {
            stdioServersEnabled: false,
            dockerInDockerEnabled: false,
          },
        },
        timestamp: 1,
      });

      expect(applied).toBe(true);
      expect(behaviorService.get("stdioServersEnabled")).toBe(false);
      expect(behaviorService.get("dockerInDockerEnabled")).toBe(false);
    });

    it("drops a snapshot with a stale timestamp", () => {
      behaviorService.applyBehaviorSettings({
        newValues: {
          featureFlags: { enableResourceCapability: true },
          policies: { stdioServersEnabled: true, dockerInDockerEnabled: true },
        },
        timestamp: 100,
      });

      const applied = behaviorService.applyBehaviorSettings({
        newValues: {
          featureFlags: { enableResourceCapability: false },
          policies: {
            stdioServersEnabled: false,
            dockerInDockerEnabled: false,
          },
        },
        timestamp: 50,
      });

      expect(applied).toBe(false);
      expect(behaviorService.get("enableResourceCapability")).toBe(true);
    });

    it("accepts a snapshot with a newer timestamp", () => {
      behaviorService.applyBehaviorSettings({
        newValues: {
          featureFlags: { enableResourceCapability: true },
          policies: { stdioServersEnabled: true, dockerInDockerEnabled: true },
        },
        timestamp: 100,
      });

      const applied = behaviorService.applyBehaviorSettings({
        newValues: {
          featureFlags: { enableResourceCapability: false },
          policies: { stdioServersEnabled: true, dockerInDockerEnabled: true },
        },
        timestamp: 200,
      });

      expect(applied).toBe(true);
      expect(behaviorService.get("enableResourceCapability")).toBe(false);
    });
  });
});
