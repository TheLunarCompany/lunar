import {
  SSETargetServer,
  StdioTargetServer,
  StreamableHTTPTargetServer,
  SystemState,
  TargetServerState,
  TargetServerTool,
} from "@mcpx/shared-model/api";
import { Clock } from "@mcpx/toolkit-core/time";
import { Logger } from "winston";
import { Tool as McpTool } from "@modelcontextprotocol/sdk/types.js";
import { Tool } from "../model/target-servers.js";

class InternalUsage {
  callCount: number;
  lastCalledAt?: Date;

  constructor() {
    this.callCount = 0;
    this.lastCalledAt = undefined;
  }

  increment(props: { now: Date; count?: number }): void {
    const { now } = props;
    let { count } = props;
    if (count === undefined) {
      count = 1;
    }
    this.callCount += count;
    this.lastCalledAt = now;
  }
}

interface InternalMcpxInstance {
  targetServersByName: Map<string, InternalTargetServer>;
  targetServersByName_new: Map<string, InternalTargetServerNew>;
  connectedClientsBySessionId: Map<string, InternalConnectedClient>;
  usage: InternalUsage;
  lastUpdatedAt: Date;
}

interface InternalTargetServer {
  originalTools: McpTool[];
  toolsByName: Map<string, InternalTargetServerTool>;
  usage: InternalUsage;
  args?: string[];
  command: string;
  env?: Record<string, string>;
  icon?: string;
}

interface InternalStdioTargetServer {
  _type: "stdio";
  state: TargetServerState;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  icon?: string;
  toolsByName: Map<string, InternalTargetServerTool>;
  originalTools: McpTool[];
  usage: InternalUsage;
}

interface InternalRemoteTargetServer {
  state: TargetServerState;
  url: string;
  icon?: string;
  toolsByName: Map<string, InternalTargetServerTool>;
  originalTools: McpTool[];
  usage: InternalUsage;
}

type InternalSSETargetServer = InternalRemoteTargetServer & {
  _type: "sse";
};

type InternalStreamableHTTPTargetServer = InternalRemoteTargetServer & {
  _type: "streamable-http";
};

type InternalTargetServerNew =
  | InternalStdioTargetServer
  | InternalSSETargetServer
  | InternalStreamableHTTPTargetServer;

interface InternalConnectedClient {
  usage: InternalUsage;
  clientId: string; // Stable unique identifier for the agent
  consumerTag?: string;
  llm?: {
    provider?: string;
    modelId?: string;
  };
}

interface InternalTargetServerTool {
  usage: InternalUsage;
  inputSchema: Tool["inputSchema"];
  description?: string;
}

type WithoutUsage<T> = Omit<T, "usage" | "tools"> & {
  tools: Omit<TargetServerTool, "usage">[];
};
type StdioTargetServerWithoutUsage = WithoutUsage<StdioTargetServer>;
type SSETargetServerWithoutUsage = WithoutUsage<SSETargetServer>;
type StreamableHTTPTargetServerWithoutUsage =
  WithoutUsage<StreamableHTTPTargetServer>;
export type TargetServerNewWithoutUsage =
  | StdioTargetServerWithoutUsage
  | SSETargetServerWithoutUsage
  | StreamableHTTPTargetServerWithoutUsage;

export class SystemStateTracker {
  private clock: Clock;
  private state: InternalMcpxInstance;
  private listeners = new Set<(snapshot: SystemState) => void>();
  private logger: Logger;

  constructor(clock: Clock, logger: Logger) {
    this.clock = clock;

    this.state = {
      targetServersByName: new Map(),
      targetServersByName_new: new Map(),
      connectedClientsBySessionId: new Map(),
      usage: new InternalUsage(),
      lastUpdatedAt: this.clock.now(),
    };
    this.logger = logger.child({ component: "SystemStateTracker" });
  }

  // Returns a function to unsubscribe from updates
  subscribe(cb: (snapshot: SystemState) => void): () => void {
    this.listeners.add(cb);
    cb(this.export());

    return () => this.listeners.delete(cb);
  }

  private notifyListeners(): void {
    const snapshot = this.export();
    this.listeners.forEach((cb) => cb(snapshot));
  }

  export(): SystemState {
    return {
      targetServers: this.exportTargetServers(),
      targetServers_new: this.exportTargetServersNew(),
      connectedClients: this.exportConnectedClients(),
      usage: this.state.usage,
      lastUpdatedAt: this.state.lastUpdatedAt,
    };
  }

  recordTargetServerConnection(
    targetServer: TargetServerNewWithoutUsage,
  ): void {
    if (targetServer._type === "stdio") {
      // TODO: Remove this once we fully migrate to the new format
      this.recordTargetServerConnected_old(targetServer);
    }
    const current = this.state.targetServersByName_new.get(targetServer.name);
    if (current) {
      this.logger.info("updating existing target server", {
        name: targetServer.name,
        currentState: current.state,
        newState: targetServer.state,
      });
    }
    switch (targetServer._type) {
      case "stdio":
        this.state.targetServersByName_new.set(
          targetServer.name,
          this.translateStdioTargetServer(targetServer),
        );
        break;
      case "sse":
      case "streamable-http":
        this.state.targetServersByName_new.set(
          targetServer.name,
          this.translateRemoteTargetServer(targetServer),
        );
        break;
    }
    this.state.lastUpdatedAt = this.clock.now();
    this.notifyListeners();
  }

  recordTargetServerDisconnected(targetServer: { name: string }): void {
    this.state.targetServersByName.delete(targetServer.name); // TODO: Remove when old format is no longer used
    this.state.targetServersByName_new.delete(targetServer.name);
    this.state.lastUpdatedAt = this.clock.now();
    this.notifyListeners();
  }

  recordToolCall(call: {
    targetServerName: string;
    toolName: string;
    sessionId?: string;
  }): void {
    const now = this.clock.now();
    this.state.lastUpdatedAt = now;

    this.state.usage.increment({ now });

    this.recordToolCallInternal(call, this.state.targetServersByName, now);
    this.recordToolCallInternal(call, this.state.targetServersByName_new, now);

    if (call.sessionId) {
      const client = this.state.connectedClientsBySessionId.get(call.sessionId);
      if (client) {
        client.usage.increment({ now });
      }
    }

    this.notifyListeners();
  }

  recordClientConnected(client: {
    sessionId: string;
    client: Omit<InternalConnectedClient, "usage">;
  }): void {
    const now = this.clock.now();
    this.state.lastUpdatedAt = now;

    this.state.connectedClientsBySessionId.set(client.sessionId, {
      ...client.client,
      usage: new InternalUsage(),
    });
    this.notifyListeners();
  }

  recordClientDisconnected(_client: { sessionId: string }): void {
    this.state.connectedClientsBySessionId.delete(_client.sessionId);
    this.state.lastUpdatedAt = this.clock.now();
    this.notifyListeners();
  }

  private exportTargetServers(): SystemState["targetServers"] {
    return Array.from(this.state.targetServersByName.entries()).map(
      ([name, server]) => ({
        args: server.args?.join(" ") || "",
        command: server.command,
        env: JSON.stringify(server.env) || "{}",
        icon: server.icon,
        name,
        tools: Array.from(server.toolsByName.entries()).map(
          ([toolName, tool]) => ({
            name: toolName,
            usage: tool.usage,
            description: tool.description,
            inputSchema: tool.inputSchema,
          }),
        ),
        originalTools: server.originalTools,
        usage: server.usage,
      }),
    );
  }

  private exportTargetServersNew(): SystemState["targetServers_new"] {
    return Array.from(this.state.targetServersByName_new.entries()).map(
      ([name, server]) => {
        const tools = Array.from(server.toolsByName.entries()).map(
          ([toolName, tool]) => ({
            name: toolName,
            usage: tool.usage,
            inputSchema: tool.inputSchema,
            description: tool.description,
          }),
        );
        switch (server._type) {
          case "stdio":
            return {
              _type: "stdio",
              state: server.state,
              name,
              command: server.command,
              args: server.args,
              env: server.env,
              icon: server.icon,
              tools,
              originalTools: server.originalTools,
              usage: server.usage,
            };
          case "sse":
            return {
              _type: "sse",
              state: server.state,
              name,
              url: server.url,
              icon: server.icon,
              tools,
              originalTools: server.originalTools,
              usage: server.usage,
            };
          case "streamable-http":
            return {
              _type: "streamable-http",
              state: server.state,
              name,
              url: server.url,
              icon: server.icon,
              tools,
              originalTools: server.originalTools,
              usage: server.usage,
            };
        }
      },
    );
  }

  private exportConnectedClients(): SystemState["connectedClients"] {
    return Array.from(this.state.connectedClientsBySessionId.entries()).map(
      ([sessionId, client]) => ({
        sessionId,
        clientId: client.clientId,
        usage: client.usage,
        consumerTag: client.consumerTag,
        llm: client.llm,
      }),
    );
  }

  private recordToolCallInternal(
    call: {
      targetServerName: string;
      toolName: string;
      sessionId?: string;
    },
    map:
      | Map<string, InternalTargetServer>
      | Map<string, InternalTargetServerNew>,
    now: Date,
  ): void {
    const server = map.get(call.targetServerName);
    if (!server) {
      return;
    }
    server.usage.increment({ now });

    const tool = server.toolsByName.get(call.toolName);
    if (!tool) {
      return;
    }
    tool.usage.increment({ now });
  }

  private translateRemoteTargetServer(
    targetServer:
      | SSETargetServerWithoutUsage
      | StreamableHTTPTargetServerWithoutUsage,
  ): InternalStreamableHTTPTargetServer | InternalSSETargetServer {
    return {
      _type: targetServer._type,
      state: targetServer.state,
      url: targetServer.url,
      icon: targetServer.icon,
      toolsByName: this.translateTools(targetServer.tools),
      originalTools: targetServer.originalTools,
      usage: new InternalUsage(),
    };
  }
  private translateStdioTargetServer(
    targetServer: StdioTargetServerWithoutUsage,
  ): InternalStdioTargetServer {
    return {
      _type: "stdio",
      state: targetServer.state,
      command: targetServer.command,
      args: targetServer.args,
      env: targetServer.env,
      icon: targetServer.icon,
      toolsByName: this.translateTools(targetServer.tools),
      originalTools: targetServer.originalTools,
      usage: new InternalUsage(),
    };
  }

  private translateTools(
    tools: TargetServerNewWithoutUsage["tools"],
  ): Map<string, InternalTargetServerTool> {
    return new Map(
      tools.map((tool) => [
        tool.name,
        {
          usage: new InternalUsage(),
          inputSchema: tool.inputSchema,
          description: tool.description,
        },
      ]),
    );
  }

  // TODO: Remove when old format is no longer used
  private recordTargetServerConnected_old(targetServer: {
    args?: string[];
    command: string;
    env?: Record<string, string>;
    icon?: string;
    name: string;
    tools: Tool[];
    originalTools: Tool[];
  }): void {
    const current = this.state.targetServersByName.get(targetServer.name);
    if (!current) {
      this.state.targetServersByName.set(targetServer.name, {
        toolsByName: new Map(
          targetServer.tools.map((tool) => [
            tool.name,
            {
              usage: new InternalUsage(),
              description: tool.description,
              inputSchema: tool.inputSchema,
            },
          ]),
        ),
        originalTools: targetServer.originalTools,
        usage: new InternalUsage(),
        icon: targetServer.icon,
        command: targetServer.command,
        args: targetServer.args,
        env: targetServer.env,
      });
    }
    this.state.lastUpdatedAt = this.clock.now();
  }
}
