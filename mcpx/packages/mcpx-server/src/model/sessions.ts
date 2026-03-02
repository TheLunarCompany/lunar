import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ConsumerConfig } from "./config/permissions.js";
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
  toolCallCache?: Map<string, ToolCallCacheEntry>;
  liveness?: {
    lastSeenAt: number;
    stopPing: () => void;
  };
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
}

export interface McpClientAdapter {
  name: "mcp-remote"; // essentially a union type, right now we only recognize mcp-remote
  version?: SemVer;
  support?: {
    ping: boolean;
  };
}
