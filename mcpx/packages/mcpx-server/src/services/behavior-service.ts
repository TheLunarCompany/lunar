import { McpxBehaviorSettings } from "@mcpx/webapp-protocol/messages";
import { AuditLogService } from "./audit-log/audit-log-service.js";
import { Logger } from "winston";
import z from "zod/v4";
import { logLevelSchema } from "../env.js";

// ==================== TYPES ==========================
// We hold all of the behaviors of audit logs purpose.
// temp types until we will migrate all of the settings
export type McpxBehaviorFeatureFlags = McpxBehaviorSettings["featureFlags"] & {
  strictnessRequired: boolean;
  enablePromptCapability: boolean;
  enableSkillScoping: boolean;
};

export type McpxBehaviorPolicies = McpxBehaviorSettings["policies"] & {
  logLevel: z.infer<typeof logLevelSchema>;
};

export enum BehaviorSetting {
  STRICTNESS_REQUIRED = "strictnessRequired",
  ENABLE_RESOURCE_CAPABILITY = "enableResourceCapability",
  ENABLE_PROMPT_CAPABILITY = "enablePromptCapability",
  ENABLE_SKILL_SCOPING = "enableSkillScoping",
  LOG_LEVEL = "logLevel",
  ENABLE_STDIO_MCP_SERVERS = "stdioServersEnabled",
  DIND_ENABLED = "dockerInDockerEnabled",
}

export type McpxBehavior = {
  featureFlags: McpxBehaviorFeatureFlags;
  policies: McpxBehaviorPolicies;
};

// hub only behavior settings. Settings that are not included here are not yet migrated to hub source and still comes from env vars (hive)
export type HubSourcedMcpxBehaviors = McpxBehaviorSettings["featureFlags"] &
  McpxBehaviorSettings["policies"];

export interface BehaviorServiceI {
  applyBehaviorSettings(params: {
    newValues: McpxBehaviorSettings;
    timestamp: number;
  }): boolean;
  get<K extends keyof HubSourcedMcpxBehaviors>(
    setting: K,
  ): HubSourcedMcpxBehaviors[K];
}

// ========================= Class ==================================
export class BehaviorService implements BehaviorServiceI {
  private current: McpxBehavior;
  private lastBehaviorSettingsAt: number | null = null;
  private logger: Logger;

  constructor(
    private readonly auditLogService: AuditLogService,
    initialValues: McpxBehavior,
    logger: Logger,
  ) {
    this.current = structuredClone({
      featureFlags: { ...initialValues.featureFlags },
      policies: { ...initialValues.policies },
    });
    this.logger = logger.child({ component: "BehaviorService" });
    this.auditLogService.log({
      eventType: "behavior_updated",
      payload: {
        featureFlags: this.current.featureFlags,
        policies: this.current.policies,
      },
    });
  }

  applyBehaviorSettings(params: {
    newValues: McpxBehaviorSettings;
    timestamp: number;
  }): boolean {
    const { newValues, timestamp } = params;
    if (
      this.lastBehaviorSettingsAt !== null &&
      timestamp < this.lastBehaviorSettingsAt
    ) {
      this.logger.debug("Dropping stale set-mcpx-behavior snapshot", {
        incomingTimestamp: timestamp,
        lastAppliedTimestamp: this.lastBehaviorSettingsAt,
      });
      return false;
    }
    // message contains updated data, we can use it
    this.current = structuredClone({
      // update the hub data that we know for now doesn't includes all of the behaviors.
      featureFlags: { ...this.current.featureFlags, ...newValues.featureFlags },
      policies: {
        ...this.current.policies,
        ...newValues.policies,
      },
    });
    this.lastBehaviorSettingsAt = timestamp;
    this.auditLogService.log({
      eventType: "behavior_updated",
      payload: {
        featureFlags: this.current.featureFlags,
        policies: this.current.policies,
      },
    });
    return true;
  }

  get<K extends keyof HubSourcedMcpxBehaviors>(
    setting: K,
  ): HubSourcedMcpxBehaviors[K] {
    const totalBehaviors: HubSourcedMcpxBehaviors = {
      ...this.current.featureFlags,
      ...this.current.policies,
    };
    return totalBehaviors[setting];
  }
}
