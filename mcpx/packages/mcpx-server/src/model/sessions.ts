import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ConsumerConfig } from "./config/permissions.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SemVer } from "semver";

export enum CloseSessionReason {
  TransportError = "transport_error",
  SseClosed = "sse_closed",
  SseError = "sse_error",
  StreamableDelete = "streamable_delete",
  StreamableClosed = "streamable_closed",
  StreamableError = "streamable_error",
  IdleTtlExceeded = "idle_ttl_exceeded",
  Shutdown = "shutdown",
  ProbeTermination = "probe_termination",
}

export enum TouchSource {
  Ping = "ping",
  SsePostMessages = "sse_post_messages",
  StreamablePostMcp = "streamable_post_mcp",
  StreamableGetMcp = "streamable_get_mcp",
}

export interface SessionsManagerConfig {
  pingIntervalMs: number;
  probeClientsGraceLivenessPeriodMs: number;
  sessionTtlMin: number;
  sessionSweepIntervalMin?: number;
}

export interface SessionLivenessConfig {
  pingIntervalMs: number;
  probeClientsGraceLivenessPeriodMs: number;
  sessionTtlMin: number;
  sessionSweepIntervalMin?: number;
}

export interface McpxSession {
  transport:
    | { type: "sse"; transport: SSEServerTransport }
    | { type: "streamableHttp"; transport: StreamableHTTPServerTransport };
  server: Server;
  consumerConfig: ConsumerConfig | undefined | null; // undefined if not searched yet, null if not found
  metadata: McpxSessionMetadata;
  liveness?: {
    lastSeenAt: number;
    stopPing: () => void;
  };
}

export interface SessionLivenessStore {
  getSession: (sessionId: string) => McpxSession | undefined;
  listSessions: () => Iterable<[string, McpxSession]>;
  closeSession: (
    sessionId: string,
    reason: CloseSessionReason,
  ) => Promise<void>;
}

export interface McpxSessionMetadata {
  consumerTag?: string;
  clientId: string;
  llm?: {
    provider?: string;
    modelId?: string;
  };
  clientInfo: {
    protocolVersion?: string;
    name?: string;
    version?: string;
    adapter?: McpClientAdapter;
  };
  isProbe: boolean;
}

export interface McpClientAdapter {
  name: "mcp-remote"; // essentially a union type, right now we only recognize mcp-remote
  version?: SemVer;
  support?: {
    ping: boolean;
  };
}
