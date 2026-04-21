import { Config } from "./config/config.js";

export type ToolUsedPayload = {
  toolName: string;
  targetServerName: string;
  args?: Record<string, unknown>;
  consumerTag?: string;
};

export type ConfigAppliedPayload = {
  version: number;
  config: Config;
};

// We define strongly typed event types
export interface ToolUsedEvent {
  eventType: "tool_used";
  payload: ToolUsedPayload;
}

export interface ConfigAppliedEvent {
  eventType: "config_applied";
  payload: ConfigAppliedPayload;
}

export type AuditLogEvent = ToolUsedEvent | ConfigAppliedEvent;

export type AuditLog = { timestamp: Date; createdAt?: Date } & AuditLogEvent;
