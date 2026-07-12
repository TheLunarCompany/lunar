import { z } from "zod/v4";

export const auditLogEventTypeSchema = z.enum([
  "tool_used",
  "prompt_used",
  "resource_read",
  "target_server_added",
  "target_server_removed",
  "agent_permission_updated",
  "catalog_updated",
]);

export type AuditLogEventType = z.infer<typeof auditLogEventTypeSchema>;

const baseAuditLogSchema = z.object({
  timestamp: z.coerce.date(),
  createdAt: z.coerce.date().optional(),
});

const approvedToolsChangeSchema = z.object({
  serverName: z.string(),
  addedTools: z.array(z.string()),
  removedTools: z.array(z.string()),
});

const approvedPromptsChangeSchema = z.object({
  serverName: z.string(),
  addedPrompts: z.array(z.string()),
  removedPrompts: z.array(z.string()),
});

export const auditLogEntrySchema = z.discriminatedUnion("eventType", [
  baseAuditLogSchema.extend({
    eventType: z.literal("tool_used"),
    payload: z.object({
      toolName: z.string(),
      targetServerName: z.string(),
      args: z.record(z.string(), z.unknown()).optional(),
      consumerTag: z.string().optional(),
    }),
  }),
  baseAuditLogSchema.extend({
    eventType: z.literal("prompt_used"),
    payload: z.object({
      promptName: z.string(),
      targetServerName: z.string(),
      args: z.record(z.string(), z.unknown()).optional(),
      consumerTag: z.string().optional(),
    }),
  }),
  baseAuditLogSchema.extend({
    eventType: z.literal("resource_read"),
    payload: z.object({
      resourceUri: z.string(),
      targetServerName: z.string(),
      consumerTag: z.string().optional(),
    }),
  }),
  baseAuditLogSchema.extend({
    eventType: z.literal("target_server_added"),
    payload: z.object({ name: z.string() }),
  }),
  baseAuditLogSchema.extend({
    eventType: z.literal("target_server_removed"),
    payload: z.object({ name: z.string() }),
  }),
  baseAuditLogSchema.extend({
    eventType: z.literal("agent_permission_updated"),
    payload: z.object({
      name: z.string(),
      identityType: z.enum(["consumers", "clientNames"]),
      addedServers: z.array(z.string()),
      removedServers: z.array(z.string()),
    }),
  }),
  baseAuditLogSchema.extend({
    eventType: z.literal("catalog_updated"),
    payload: z.object({
      addedServers: z.array(z.string()),
      removedServers: z.array(z.string()),
      approvedToolsChanges: z.array(approvedToolsChangeSchema),
      // Optional with a default so audit logs persisted before prompt support
      // (which lack this field) still parse on read.
      approvedPromptsChanges: z.array(approvedPromptsChangeSchema).default([]),
    }),
  }),
]);

export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

export const auditLogsQuerySchema = z.object({
  eventType: z
    .union([auditLogEventTypeSchema, z.array(auditLogEventTypeSchema)])
    .optional()
    .transform((v) =>
      v === undefined ? undefined : Array.isArray(v) ? v : [v],
    ),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;

export const auditLogsResponseSchema = z.object({
  events: z.array(auditLogEntrySchema),
});

export type AuditLogsResponse = z.infer<typeof auditLogsResponseSchema>;
