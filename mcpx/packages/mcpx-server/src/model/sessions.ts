import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ConsumerConfig } from "./config/permissions.js";
import { SemVer } from "semver";

export interface McpxSession {
  transport:
    | { type: "sse"; transport: SSEServerTransport }
    | { type: "streamableHttp"; transport: StreamableHTTPServerTransport };
  consumerConfig: ConsumerConfig | undefined | null; // undefined if not searched yet, null if not found
  metadata: McpxSessionMetadata;
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
