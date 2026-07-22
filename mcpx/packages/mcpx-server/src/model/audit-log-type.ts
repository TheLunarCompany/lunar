export type ToolUsedPayload = {
  toolName: string;
  targetServerName: string;
  args?: Record<string, unknown>;
  consumerTag?: string;
};

export type PromptUsedPayload = {
  promptName: string;
  targetServerName: string;
  args?: Record<string, unknown>;
  consumerTag?: string;
};

export type ResourceReadPayload = {
  resourceUri: string;
  targetServerName: string;
  consumerTag?: string;
};

export type TargetServerAddedPayload = {
  name: string;
};

export type TargetServerRemovedPayload = {
  name: string;
};

export type AgentPermissionUpdatedPayload = {
  name: string;
  identityType: "consumers" | "clientNames";
  addedServers: string[];
  removedServers: string[];
};

// Audit payload mirrors the shared-model audit-log schema (the persisted/served
// contract), which names fields per kind. The internal CatalogChange uses a
// generic {added, removed} shape; services.ts maps it to these at the emit site.
export type ApprovedToolsChangePayload = {
  serverName: string;
  addedTools: string[];
  removedTools: string[];
};

export type ApprovedPromptsChangePayload = {
  serverName: string;
  addedPrompts: string[];
  removedPrompts: string[];
};

export type CatalogUpdatedPayload = {
  addedServers: string[];
  removedServers: string[];
  approvedToolsChanges: ApprovedToolsChangePayload[];
  approvedPromptsChanges: ApprovedPromptsChangePayload[];
};

export interface ToolUsedEvent {
  eventType: "tool_used";
  payload: ToolUsedPayload;
}

export interface PromptUsedEvent {
  eventType: "prompt_used";
  payload: PromptUsedPayload;
}

export interface ResourceReadEvent {
  eventType: "resource_read";
  payload: ResourceReadPayload;
}

export interface TargetServerAddedEvent {
  eventType: "target_server_added";
  payload: TargetServerAddedPayload;
}

export interface TargetServerRemovedEvent {
  eventType: "target_server_removed";
  payload: TargetServerRemovedPayload;
}

export interface AgentPermissionUpdatedEvent {
  eventType: "agent_permission_updated";
  payload: AgentPermissionUpdatedPayload;
}

export interface CatalogUpdatedEvent {
  eventType: "catalog_updated";
  payload: CatalogUpdatedPayload;
}

export type AuditLogEvent =
  | ToolUsedEvent
  | PromptUsedEvent
  | ResourceReadEvent
  | TargetServerAddedEvent
  | TargetServerRemovedEvent
  | AgentPermissionUpdatedEvent
  | CatalogUpdatedEvent;

export type AuditLog = { timestamp: Date; createdAt?: Date } & AuditLogEvent;
