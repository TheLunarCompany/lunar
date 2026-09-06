import {
  BehaviorServiceI,
  McpxBehaviorFeatureFlags,
  McpxBehaviorPolicies,
} from "./behavior-service.js";

// ===================== Stub for unit tests for other services==========================

export const behaviorDefaults: McpxBehaviorFeatureFlags & McpxBehaviorPolicies =
  {
    strictnessRequired: false,
    enableResourceCapability: false,
    enablePromptCapability: false,
    enableSkillScoping: false,
    logLevel: "info",
    stdioServersEnabled: true,
    dockerInDockerEnabled: true,
  };

export function stubBehaviorService(
  overrides: Partial<McpxBehaviorFeatureFlags & McpxBehaviorPolicies> = {},
): BehaviorServiceI {
  const flat = { ...behaviorDefaults, ...overrides };
  return {
    get: (setting) => flat[setting],
    applyBehaviorSettings: () => false,
  };
}
