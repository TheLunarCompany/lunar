import { McpxSessionMetadata } from "../model/sessions.js";

export interface PersistedDownstreamSessionData {
  metadata: McpxSessionMetadata;
}

export interface PersistedDownstreamSessionEntry {
  sessionId: string;
  data: PersistedDownstreamSessionData;
}

export interface DownstreamSessionStore {
  store(sessionId: string, data: PersistedDownstreamSessionData): Promise<void>;
  load(sessionId: string): Promise<PersistedDownstreamSessionData | undefined>;
  delete(sessionId: string): Promise<void>;
  // Every persisted session for this mcpx instance, for startup recovery.
  list(): Promise<PersistedDownstreamSessionEntry[]>;
}
