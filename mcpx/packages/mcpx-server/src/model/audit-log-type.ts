export type ToolUsedPayload = {
  toolName: string;
  targetServerName: string;
  args?: Record<string, unknown>;
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

export type ApprovedToolsChangePayload = {
  serverName: string;
  addedTools: string[];
  removedTools: string[];
};

export type CatalogUpdatedPayload = {
  addedServers: string[];
  removedServers: string[];
  approvedToolsChanges: ApprovedToolsChangePayload[];
};

export interface ToolUsedEvent {
  eventType: "tool_used";
  payload: ToolUsedPayload;
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
  | TargetServerAddedEvent
  | TargetServerRemovedEvent
  | AgentPermissionUpdatedEvent
  | CatalogUpdatedEvent;

export type AuditLog = { timestamp: Date; createdAt?: Date } & AuditLogEvent;
