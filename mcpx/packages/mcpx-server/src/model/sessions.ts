import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ConsumerConfig } from "@mcpx/shared-model";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolResult,
  CompatibilityCallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { SemVer } from "semver";

export enum CloseSessionReason {
  TransportError = "transport_error",
  TransportDelete = "transport_delete",
  TransportClosed = "transport_closed",
  IdleTtlExceeded = "idle_ttl_exceeded",
  Shutdown = "shutdown",
  ProbeTermination = "probe_termination",
  PingTimeout = "ping_timeout",
}

export enum TouchSource {
  Ping = "ping",
  TransportPostMcp = "transport_post_mcp",
  TransportGetMcp = "transport_get_mcp",
}

export interface SessionsManagerConfig {
  pingIntervalMs: number;
  probeClientsGraceLivenessPeriodMs: number;
  sessionTtlMin: number;
  sessionSweepIntervalMin?: number;
  // Consecutive missed pings before the session is reaped.
  pingMaxConsecutiveTimeouts: number;
  notificationStreamReconnectGraceMs: number;
}

export interface SessionLivenessConfig {
  pingIntervalMs: number;
  probeClientsGraceLivenessPeriodMs: number;
  sessionTtlMin: number;
  sessionSweepIntervalMin?: number;
  pingMaxConsecutiveTimeouts: number;
  notificationStreamReconnectGraceMs: number;
}

export type NotificationStream =
  | { _type: "none" } // no GET yet, or it closed and activity cancelled the wait
  | { _type: "opening"; generation: number } // GET arrived; SDK hasn't accepted it yet
  | { _type: "open"; generation: number } // SSE response confirmed; pings can go
  | { _type: "reconnecting"; generation: number; cancelGrace: () => void }; // dropped; waiting out the grace period

// Learned from actual ping responses rather than client/version metadata.
export type PingSupport = "unknown" | "answered" | "unsupported";

export interface SessionLiveness {
  lastSeenAt: number;
  // Missed at least one ping, or the notification stream stayed down past the
  // grace period. Never closes the session by itself.
  unresponsive: boolean;
  // Consecutive missed pings, reset by any inbound activity or ping success.
  consecutiveMisses: number;
  pingSupport: PingSupport;
  stopPing: () => void;
  // State of the streamableHttp standalone GET/notification stream.
  notificationStream: NotificationStream;
}

export interface McpxSession {
  transport:
    | { type: "sse"; transport: SSEServerTransport }
    | { type: "streamableHttp"; transport: StreamableHTTPServerTransport };
  server: Server;
  consumerConfig: ConsumerConfig | undefined | null; // undefined if not searched yet, null if not found
  metadata: McpxSessionMetadata;
  toolCallCache?: Map<string, ToolCallCacheEntry>;
  liveness?: SessionLiveness;
}

export type ToolCallResultUnion = CallToolResult | CompatibilityCallToolResult;

export type ToolCallCacheEntry =
  | {
      status: "pending";
      promise: Promise<ToolCallResultUnion>;
      expiresAt: number;
    }
  | {
      status: "resolved";
      result: ToolCallResultUnion;
      expiresAt: number;
    }
  | {
      status: "rejected";
      error: Error;
      expiresAt: number;
    };

export interface SessionLivenessInfo {
  lastSeenAt: number;
  unresponsive: boolean;
}

export interface SessionLivenessStore {
  getSession: (sessionId: string) => McpxSession | undefined;
  listSessions: () => Iterable<[string, McpxSession]>;
  closeSession: (
    sessionId: string,
    reason: CloseSessionReason,
  ) => Promise<void>;
}

export interface McpClientIcon {
  src: string;
  mimeType?: string;
  sizes?: string[];
}
export interface McpClientInfo {
  protocolVersion?: string;
  name?: string;
  version?: string;
  title?: string;
  websiteUrl?: string;
  icons?: McpClientIcon[];
  adapter?: McpClientAdapter;
}

export interface McpxSessionMetadata {
  consumerTag?: string;
  clientId: string;
  llm?: {
    provider?: string;
    modelId?: string;
  };
  clientInfo: McpClientInfo;
  isProbe: boolean;
  authorization?: string;
}

export interface McpClientAdapter {
  name: "mcp-remote"; // essentially a union type, right now we only recognize mcp-remote
  version?: SemVer;
  support?: {
    ping: boolean;
  };
}
