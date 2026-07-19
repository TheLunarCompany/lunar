import {
  ConnectedClient,
  ConnectedClientCluster,
  ConnectionState,
  SSETargetServer,
  StdioTargetServer,
  StreamableHTTPTargetServer,
  SystemState,
  TargetServerPrompt,
  TargetServerState,
  TargetServerTool,
  TargetServerToolParameter,
  Usage,
} from "@mcpx/shared-model/api";
import { compact, distinct } from "@mcpx/toolkit-core/data";
import { Clock } from "@mcpx/toolkit-core/time";
import { Logger } from "winston";
import {
  Prompt as McpPrompt,
  Tool as McpTool,
} from "@modelcontextprotocol/sdk/types.js";
import { EnvValue, Tool } from "../model/target-servers.js";

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
  configError?: string;
  mcpxVersion?: string;
}

interface InternalTargetServer {
  originalTools: McpTool[];
  toolsByName: Map<string, InternalTargetServerTool>;
  usage: InternalUsage;
  args?: string[];
  command: string;
  env?: Record<string, EnvValue>;
  icon?: string;
}

interface InternalStdioTargetServer {
  _type: "stdio";
  state: TargetServerState;
  catalogItemId?: string;
  command: string;
  args?: string[];
  env?: Record<string, EnvValue>;
  icon?: string;
  toolsByName: Map<string, InternalTargetServerTool>;
  originalTools: McpTool[];
  promptsByName: Map<string, InternalTargetServerPrompt>;
  originalPrompts: McpPrompt[];
  usage: InternalUsage;
}

interface InternalRemoteTargetServer {
  state: TargetServerState;
  catalogItemId?: string;
  url: string;
  headers?: Record<string, EnvValue>;
  icon?: string;
  toolsByName: Map<string, InternalTargetServerTool>;
  originalTools: McpTool[];
  promptsByName: Map<string, InternalTargetServerPrompt>;
  originalPrompts: McpPrompt[];
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
  connectionState: ConnectionState;
  lastSeenAt?: number;
  // Epoch ms the session went offline, set only for disconnected records.
  disconnectedAt?: number;
  consumerTag?: string;
  llm?: {
    provider?: string;
    modelId?: string;
  };
  clientInfo?: {
    protocolVersion?: string;
    name?: string;
    version?: string;
    adapter?: {
      name: "mcp-remote";
      version?: {
        major: number;
        minor: number;
        patch: number;
        prerelease: (string | number)[];
        build: (string | number)[];
      };
      support?: {
        ping: boolean;
      };
    };
  };
}

interface InternalTargetServerTool {
  usage: InternalUsage;
  inputSchema: Tool["inputSchema"];
  description?: string;
  estimatedTokens?: number;
  parameters?: TargetServerToolParameter[];
  annotations?: McpTool["annotations"];
}

interface InternalTargetServerPrompt {
  usage: InternalUsage;
  description?: string;
  arguments?: TargetServerPrompt["arguments"];
  messages?: TargetServerPrompt["messages"];
}

type WithoutUsage<T> = Omit<T, "usage" | "tools" | "prompts"> & {
  tools: Omit<TargetServerTool, "usage">[];
  prompts: Omit<TargetServerPrompt, "usage">[];
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
  // How long an offline client shows before pruning. Infinity = never.
  private disconnectedRetentionMs: number;
  private retentionSweepStopper?: () => void;

  constructor(
    clock: Clock,
    logger: Logger,
    options?: { disconnectedRetentionMs?: number },
  ) {
    this.clock = clock;
    this.disconnectedRetentionMs =
      options?.disconnectedRetentionMs ?? Number.POSITIVE_INFINITY;

    this.state = {
      targetServersByName: new Map(),
      targetServersByName_new: new Map(),
      connectedClientsBySessionId: new Map(),
      usage: new InternalUsage(),
      lastUpdatedAt: this.clock.now(),
      configError: undefined,
      mcpxVersion: undefined,
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
      connectedClients: this.exportConnectedClients(),
      connectedClientClusters: this.exportConnectedClientClusters(),
      usage: this.state.usage,
      lastUpdatedAt: this.state.lastUpdatedAt,
      configError: this.state.configError,
      mcpxVersion: this.state.mcpxVersion,
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

  updateTargetServerTools(props: {
    name: string;
    tools: TargetServerNewWithoutUsage["tools"];
    originalTools: McpTool[];
  }): void {
    const { name, tools, originalTools } = props;
    const current = this.state.targetServersByName_new.get(name);
    if (!current) {
      this.logger.warn("Cannot update tools for non-existent server", { name });
      return;
    }

    // Preserve usage for tools that still exist
    const newToolsByName = new Map(
      tools.map((tool) => {
        const existingTool = current.toolsByName.get(tool.name);
        return [
          tool.name,
          {
            usage: existingTool?.usage ?? new InternalUsage(),
            inputSchema: tool.inputSchema,
            description: tool.description,
            estimatedTokens: tool.estimatedTokens,
            parameters: tool.parameters,
            annotations: tool.annotations,
          },
        ];
      }),
    );

    current.toolsByName = newToolsByName;
    current.originalTools = originalTools;
    this.state.lastUpdatedAt = this.clock.now();
    this.notifyListeners();
  }

  updateTargetServerPrompts(props: {
    name: string;
    prompts: TargetServerNewWithoutUsage["prompts"];
    originalPrompts: McpPrompt[];
  }): void {
    const { name, prompts, originalPrompts } = props;
    const current = this.state.targetServersByName_new.get(name);
    if (!current) {
      this.logger.warn("Cannot update prompts for non-existent server", {
        name,
      });
      return;
    }

    const newPromptsByName = new Map(
      prompts.map((prompt) => {
        const existing = current.promptsByName.get(prompt.name);
        return [
          prompt.name,
          {
            usage: existing?.usage ?? new InternalUsage(),
            description: prompt.description,
            arguments: prompt.arguments,
            messages: prompt.messages,
          },
        ];
      }),
    );

    current.promptsByName = newPromptsByName;
    current.originalPrompts = originalPrompts;
    this.state.lastUpdatedAt = this.clock.now();
    this.notifyListeners();
  }

  recordPromptGet(call: {
    targetServerName: string;
    promptName: string;
    sessionId?: string;
  }): void {
    const now = this.clock.now();
    this.state.lastUpdatedAt = now;

    this.state.usage.increment({ now });

    this.recordPromptGetInternal(call, this.state.targetServersByName_new, now);

    if (call.sessionId) {
      const client = this.state.connectedClientsBySessionId.get(call.sessionId);
      if (client) {
        client.usage.increment({ now });
      }
    }

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
    client: Omit<
      InternalConnectedClient,
      "usage" | "connectionState" | "lastSeenAt" | "disconnectedAt"
    >;
  }): void {
    const now = this.clock.now();
    this.state.lastUpdatedAt = now;

    this.state.connectedClientsBySessionId.set(client.sessionId, {
      ...client.client,
      usage: new InternalUsage(),
      connectionState: "connected",
    });
    this.notifyListeners();
  }

  recordClientDisconnected(_client: { sessionId: string }): void {
    this.state.connectedClientsBySessionId.delete(_client.sessionId);
    this.state.lastUpdatedAt = this.clock.now();
    this.notifyListeners();
  }

  // Flip a client to offline but keep the card until retention prunes it, so a
  // disconnect stays visible. No-op if the session was never recorded (probes).
  markClientDisconnected(sessionId: string, disconnectedAt: number): void {
    const client = this.state.connectedClientsBySessionId.get(sessionId);
    if (!client) {
      return;
    }
    client.connectionState = "disconnected";
    client.disconnectedAt = disconnectedAt;
    this.state.lastUpdatedAt = this.clock.now();
    this.notifyListeners();
  }

  // Flip a live client between connected and unresponsive. No-op if unknown.
  setClientConnectionState(
    sessionId: string,
    connectionState: ConnectionState,
    opts?: { lastSeenAt?: number },
  ): void {
    const client = this.state.connectedClientsBySessionId.get(sessionId);
    if (!client) {
      return;
    }
    client.connectionState = connectionState;
    if (opts?.lastSeenAt !== undefined) {
      client.lastSeenAt = opts.lastSeenAt;
    }
    if (connectionState !== "disconnected") {
      client.disconnectedAt = undefined;
    }
    this.state.lastUpdatedAt = this.clock.now();
    this.notifyListeners();
  }

  // Surface a previously-connected agent as offline. Never clobbers a live entry.
  recordDisconnectedClient(props: {
    sessionId: string;
    client: Omit<
      InternalConnectedClient,
      "usage" | "connectionState" | "disconnectedAt" | "lastSeenAt"
    >;
    disconnectedAt: number;
    lastSeenAt?: number;
  }): void {
    if (this.state.connectedClientsBySessionId.has(props.sessionId)) {
      return;
    }
    this.state.connectedClientsBySessionId.set(props.sessionId, {
      ...props.client,
      usage: new InternalUsage(),
      connectionState: "disconnected",
      disconnectedAt: props.disconnectedAt,
      lastSeenAt: props.lastSeenAt,
    });
    this.state.lastUpdatedAt = this.clock.now();
    this.notifyListeners();
  }

  // Re-broadcast the snapshot when a change lives outside this tracker.
  notifyChanged(): void {
    this.state.lastUpdatedAt = this.clock.now();
    this.notifyListeners();
  }

  setConfigError(error: string): void {
    this.state.configError = error;
    this.notifyListeners();
  }

  clearConfigError(): void {
    this.state.configError = undefined;
    this.notifyListeners();
  }

  resetTargetServers(): void {
    this.state.targetServersByName.clear();
    this.state.targetServersByName_new.clear();
    this.state.lastUpdatedAt = this.clock.now();
    this.notifyListeners();
  }

  setMcpxVersion(version: string): void {
    this.state.mcpxVersion = version;
    this.state.lastUpdatedAt = this.clock.now();
    this.notifyListeners();
  }

  private exportTargetServers(): SystemState["targetServers"] {
    return Array.from(this.state.targetServersByName_new.entries()).map(
      ([name, server]) => {
        const tools = Array.from(server.toolsByName.entries()).map(
          ([toolName, tool]) => ({
            name: toolName,
            usage: tool.usage,
            inputSchema: tool.inputSchema,
            description: tool.description,
            estimatedTokens: tool.estimatedTokens,
            parameters: tool.parameters,
            annotations: tool.annotations,
          }),
        );
        const prompts = Array.from(server.promptsByName.entries()).map(
          ([promptName, prompt]) => ({
            name: promptName,
            usage: prompt.usage,
            description: prompt.description,
            arguments: prompt.arguments,
            messages: prompt.messages,
          }),
        );
        switch (server._type) {
          case "stdio":
            return {
              _type: "stdio",
              state: server.state,
              name,
              catalogItemId: server.catalogItemId,
              command: server.command,
              args: server.args,
              env: server.env,
              icon: server.icon,
              tools,
              originalTools: server.originalTools,
              prompts,
              originalPrompts: server.originalPrompts,
              usage: server.usage,
            };
          case "sse":
          case "streamable-http": {
            return {
              _type: server._type,
              state: server.state,
              name,
              catalogItemId: server.catalogItemId,
              url: server.url,
              headers: server.headers,
              icon: server.icon,
              tools,
              originalTools: server.originalTools,
              prompts,
              originalPrompts: server.originalPrompts,
              usage: server.usage,
            };
          }
        }
      },
    );
  }

  // Drop offline records past retention. Returns whether any were removed.
  private pruneExpiredDisconnected(now: number): boolean {
    let removed = false;
    for (const [sessionId, client] of this.state.connectedClientsBySessionId) {
      if (
        client.connectionState === "disconnected" &&
        client.disconnectedAt !== undefined &&
        now - client.disconnectedAt > this.disconnectedRetentionMs
      ) {
        this.state.connectedClientsBySessionId.delete(sessionId);
        removed = true;
      }
    }
    return removed;
  }

  // Removes and re-broadcasts expired offline agents at their deadline.
  startRetentionSweep(intervalMs: number): void {
    if (
      this.retentionSweepStopper ||
      !Number.isFinite(this.disconnectedRetentionMs) ||
      intervalMs <= 0
    ) {
      return;
    }
    const timer = setInterval(() => {
      if (this.pruneExpiredDisconnected(this.clock.now().getTime())) {
        this.state.lastUpdatedAt = this.clock.now();
        this.notifyListeners();
      }
    }, intervalMs);
    this.retentionSweepStopper = (): void => {
      clearInterval(timer);
      this.retentionSweepStopper = undefined;
    };
  }

  stopRetentionSweep(): void {
    this.retentionSweepStopper?.();
  }

  private exportConnectedClients(): SystemState["connectedClients"] {
    const now = this.clock.now().getTime();
    this.pruneExpiredDisconnected(now);
    const result: ConnectedClient[] = [];
    for (const [sessionId, client] of this.state.connectedClientsBySessionId) {
      result.push({
        sessionId,
        clientId: client.clientId,
        usage: client.usage,
        consumerTag: client.consumerTag,
        llm: client.llm,
        clientInfo: client.clientInfo,
        // Defaulted until populated per session (T03).
        dynamicMode: false,
        visibleTools: [],
        lastSeenAt: client.lastSeenAt,
        connectionState: client.connectionState,
        disconnectedAt: client.disconnectedAt,
      });
    }
    return result;
  }

  private exportConnectedClientClusters(): SystemState["connectedClientClusters"] {
    const buckets = new Map<
      string,
      { identity: SessionIdentity; clients: ConnectedClient[] }
    >();
    for (const client of this.exportConnectedClients()) {
      const identity = deriveIdentity(client);
      const key = identityKey(identity);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.clients.push(client);
      } else {
        buckets.set(key, { identity, clients: [client] });
      }
    }
    return Array.from(buckets.values()).map(({ identity, clients }) =>
      buildCluster(clients, identity),
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

  private recordPromptGetInternal(
    call: {
      targetServerName: string;
      promptName: string;
      sessionId?: string;
    },
    map: Map<string, InternalTargetServerNew>,
    now: Date,
  ): void {
    const server = map.get(call.targetServerName);
    if (!server) {
      return;
    }
    server.usage.increment({ now });

    const prompt = server.promptsByName.get(call.promptName);
    if (!prompt) {
      return;
    }
    prompt.usage.increment({ now });
  }

  private translateRemoteTargetServer(
    targetServer:
      | SSETargetServerWithoutUsage
      | StreamableHTTPTargetServerWithoutUsage,
  ): InternalStreamableHTTPTargetServer | InternalSSETargetServer {
    return {
      _type: targetServer._type,
      state: targetServer.state,
      catalogItemId: targetServer.catalogItemId,
      url: targetServer.url,
      headers: targetServer.headers,
      icon: targetServer.icon,
      toolsByName: this.translateTools(targetServer.tools),
      originalTools: targetServer.originalTools,
      promptsByName: this.translatePrompts(targetServer.prompts),
      originalPrompts: targetServer.originalPrompts ?? [],
      usage: new InternalUsage(),
    };
  }
  private translateStdioTargetServer(
    targetServer: StdioTargetServerWithoutUsage,
  ): InternalStdioTargetServer {
    return {
      _type: "stdio",
      state: targetServer.state,
      catalogItemId: targetServer.catalogItemId,
      command: targetServer.command,
      args: targetServer.args,
      env: targetServer.env,
      icon: targetServer.icon,
      toolsByName: this.translateTools(targetServer.tools),
      originalTools: targetServer.originalTools,
      promptsByName: this.translatePrompts(targetServer.prompts),
      originalPrompts: targetServer.originalPrompts ?? [],
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
          estimatedTokens: tool.estimatedTokens,
          parameters: tool.parameters,
          annotations: tool.annotations,
        },
      ]),
    );
  }

  private translatePrompts(
    prompts: TargetServerNewWithoutUsage["prompts"],
  ): Map<string, InternalTargetServerPrompt> {
    return new Map(
      prompts.map((prompt) => [
        prompt.name,
        {
          usage: new InternalUsage(),
          description: prompt.description,
          arguments: prompt.arguments,
          messages: prompt.messages,
        },
      ]),
    );
  }

  // TODO: Remove when old format is no longer used
  private recordTargetServerConnected_old(targetServer: {
    args?: string[];
    command: string;
    env?: Record<string, EnvValue>;
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

type SessionIdentity =
  | { type: "consumerTag"; value: string }
  | { type: "clientName"; value: string }
  | { type: "anonymous" };

function deriveIdentity(client: ConnectedClient): SessionIdentity {
  if (client.consumerTag) {
    return { type: "consumerTag", value: client.consumerTag };
  }
  if (client.clientInfo?.name) {
    return { type: "clientName", value: client.clientInfo.name };
  }
  return { type: "anonymous" };
}

function identityKey(identity: SessionIdentity): string {
  switch (identity.type) {
    case "consumerTag":
      return `consumerTag:${identity.value}`;
    case "clientName":
      return `clientName:${identity.value}`;
    case "anonymous":
      return "anonymous";
  }
}

function buildCluster(
  clients: ConnectedClient[],
  identity: SessionIdentity,
): ConnectedClientCluster {
  const sessionIds = clients.map((c) => c.sessionId);
  const usage = combineUsage(clients);
  switch (identity.type) {
    case "consumerTag":
      return {
        identityType: "consumerTag",
        consumerTag: identity.value,
        clientNames: distinct(compact(clients.map((c) => c.clientInfo?.name))),
        sessionIds,
        usage,
      };
    case "clientName":
      return {
        identityType: "clientName",
        clientName: identity.value,
        sessionIds,
        usage,
      };
    case "anonymous":
      return { identityType: "anonymous", sessionIds, usage };
  }
}

// A utility function to combine usage from multiple items assuming they have a `usage: Usage` property
function combineUsage(usingItems: { usage: Usage }[]): Usage {
  return usingItems.reduce<Usage>(
    (acc, item) => {
      acc.callCount += item.usage.callCount;
      if (
        !acc.lastCalledAt ||
        (item.usage.lastCalledAt && item.usage.lastCalledAt > acc.lastCalledAt)
      ) {
        acc.lastCalledAt = item.usage.lastCalledAt;
      }
      return acc;
    },
    { callCount: 0, lastCalledAt: undefined },
  );
}
