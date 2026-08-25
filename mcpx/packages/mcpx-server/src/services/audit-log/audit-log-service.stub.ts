import { systemClock } from "@mcpx/toolkit-core/time";
import { AuditLogEvent } from "../../model/audit-log-type.js";
import { AuditLogPersistence } from "./audit-log-persistence.js";
import { AuditLogService } from "./audit-log-service.js";
import { noOpLogger } from "@mcpx/toolkit-core/logging";

// ====================== noOp stub for tests ======================
const _noOpPersistence: AuditLogPersistence = {
  persist: async () => {},
  cleanup: async () => {},
  read: async () => [],
};

class _NoOpAuditLogService extends AuditLogService {
  override log(_event: AuditLogEvent): void {}
}

export const noOpAuditLogService: AuditLogService = new _NoOpAuditLogService(
  systemClock,
  noOpLogger,
  _noOpPersistence,
  24 * 60 * 60 * 1000,
);
