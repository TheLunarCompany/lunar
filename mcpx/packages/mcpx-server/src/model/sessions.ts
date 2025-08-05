import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ConsumerConfig } from "./config/permissions.js";

export interface McpxSession {
  transport:
    | { type: "sse"; transport: SSEServerTransport }
    | { type: "streamableHttp"; transport: StreamableHTTPServerTransport };
  consumerConfig: ConsumerConfig | undefined | null; // undefined if not searched yet, null if not found
  metadata: {
    consumerTag?: string;
    clientId: string;
    llm?: {
      provider?: string;
      modelId?: string;
    };
    clientInfo?: {
      protocolVersion?: string;
      name?: string;
      version?: string;
    };
  };
}
