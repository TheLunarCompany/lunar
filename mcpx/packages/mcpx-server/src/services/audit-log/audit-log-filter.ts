import { AuditLog, AuditLogEvent } from "../../model/audit-log-type.js";

export function matchesEventTypeFilter(
  event: AuditLog,
  eventTypes: Set<AuditLogEvent["eventType"]> | undefined,
): boolean {
  return !eventTypes || eventTypes.has(event.eventType);
}
