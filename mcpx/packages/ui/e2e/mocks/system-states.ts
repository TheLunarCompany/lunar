import {
  SystemState,
  TargetServerNew,
  ConnectedClient,
  ConnectedClientCluster,
  Usage,
} from "@mcpx/shared-model";
import { DELAY_30_SEC, DELAY_5_MIN } from "../constants/delays";

/**
 * Base mock SystemState with minimal required fields
 */
const createBaseSystemState = (): Omit<
  SystemState,
  "targetServers_new" | "connectedClients" | "connectedClientClusters"
> => ({
  targetServers: [],
  usage: {
    callCount: 0,
    lastCalledAt: undefined,
  },
  lastUpdatedAt: new Date(),
  mcpxVersion: "1.0.0",
});

/**
 * Zero state - no servers, no agents
 */
export const zeroState: SystemState = {
  ...createBaseSystemState(),
  targetServers_new: [],
  connectedClients: [],
  connectedClientClusters: [],
};

/**
 * Configuration for creating mock servers
 */
export interface MockServerConfig {
  name: string;
  type?: "stdio" | "sse" | "streamable-http";
  state?: "connected" | "pending-auth" | "connection-failed";
  toolCount?: number;
  isActive?: boolean; // If true, sets lastCalledAt to recent date
  icon?: string;
  error?: Error;
}

/**
 * Configuration for creating mock agents
 */
export interface MockAgentConfig {
  name: string;
  sessionIds?: string[];
  provider?: string;
  model?: string;
  isActive?: boolean;
}

/**
 * Create a mock server based on configuration
 */
export const createMockServer = (config: MockServerConfig): TargetServerNew => {
  const now = new Date();
  const activeDate = config.isActive
    ? new Date(now.getTime() - DELAY_5_MIN)
    : undefined; // 5 minutes ago if active

  const tools = Array.from({ length: config.toolCount || 3 }, (_, i) => ({
    name: `tool-${i + 1}`,
    description: `Tool ${i + 1} description`,
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
    usage: {
      callCount: config.isActive ? 10 : 0,
      lastCalledAt: config.isActive ? activeDate : undefined,
    } as Usage,
  }));

  const baseServer = {
    name: config.name,
    icon: config.icon,
    tools,
    originalTools: [],
    usage: {
      callCount: config.isActive ? 50 : 0,
      lastCalledAt: activeDate,
    } as Usage,
  };

  const stateType = config.state || "connected";
  let state: TargetServerNew["state"];

  if (stateType === "connected") {
    state = { type: "connected" };
  } else if (stateType === "pending-auth") {
    state = { type: "pending-auth" };
  } else {
    state = {
      type: "connection-failed",
      error: config.error || new Error("Connection failed"),
    };
  }

  const serverType = config.type || "stdio";

  if (serverType === "stdio") {
    return {
      _type: "stdio",
      ...baseServer,
      state,
      command: "node",
      args: ["server.js"],
      env: {},
    };
  } else if (serverType === "sse") {
    return {
      _type: "sse",
      ...baseServer,
      state,
      url: "http://localhost:3000/sse",
    };
  } else {
    return {
      _type: "streamable-http",
      ...baseServer,
      state,
      url: "http://localhost:3000/streamable",
      headers: {},
    };
  }
};

/**
 * Create a mock agent based on configuration
 */
export const createMockAgent = (
  config: MockAgentConfig,
): {
  client: ConnectedClient;
  cluster: ConnectedClientCluster;
} => {
  const sessionId = `session-${config.name}-${Date.now()}`;
  const sessionIds = config.sessionIds || [sessionId];
  const now = new Date();
  // isActive requires activity within last 1 minute, so set to 30 seconds ago
  const activeDate = config.isActive
    ? new Date(now.getTime() - DELAY_30_SEC)
    : undefined;

  const client: ConnectedClient = {
    sessionId: sessionIds[0],
    clientId: `client-${config.name}`,
    usage: {
      callCount: config.isActive ? 20 : 0,
      lastCalledAt: activeDate,
    } as Usage,
    llm: {
      provider: config.provider || "openai",
      modelId: config.model || "gpt-4",
    },
  };

  const cluster: ConnectedClientCluster = {
    name: config.name,
    sessionIds,
    usage: {
      callCount: config.isActive ? 20 : 0,
      lastCalledAt: activeDate,
    } as Usage,
  };

  return { client, cluster };
};

/**
 * Create a SystemState with specified number of servers and agents
 */
export const createSystemState = (options: {
  serverCount?: number;
  agentCount?: number;
  serverConfig?: Partial<MockServerConfig>;
  agentConfig?: Partial<MockAgentConfig>;
}): SystemState => {
  const {
    serverCount = 0,
    agentCount = 0,
    serverConfig = {},
    agentConfig = {},
  } = options;

  const servers: TargetServerNew[] = Array.from(
    { length: serverCount },
    (_, i) =>
      createMockServer({
        name: `server-${i + 1}`,
        ...serverConfig,
      }),
  );

  const clients: ConnectedClient[] = [];
  const clusters: ConnectedClientCluster[] = [];

  Array.from({ length: agentCount }, (_, i) => {
    const { client, cluster } = createMockAgent({
      name: `agent-${i + 1}`,
      ...agentConfig,
    });
    clients.push(client);
    clusters.push(cluster);
  });

  return {
    ...createBaseSystemState(),
    targetServers_new: servers,
    connectedClients: clients,
    connectedClientClusters: clusters,
  };
};

/**
 * Predefined system states for common test scenarios
 */
export const mockSystemStates = {
  zero: zeroState,

  oneServer: createSystemState({ serverCount: 1 }),

  multipleServers: createSystemState({ serverCount: 3 }),

  oneAgent: createSystemState({ agentCount: 1 }),

  multipleAgents: createSystemState({ agentCount: 2 }),

  oneServerOneAgent: createSystemState({ serverCount: 1, agentCount: 1 }),

  multipleServersMultipleAgents: createSystemState({
    serverCount: 3,
    agentCount: 2,
  }),

  activeServers: createSystemState({
    serverCount: 2,
    serverConfig: { isActive: true },
  }),

  pendingAuthServers: createSystemState({
    serverCount: 2,
    serverConfig: { state: "pending-auth" },
  }),

  failedServers: createSystemState({
    serverCount: 2,
    serverConfig: { state: "connection-failed" },
  }),

  mixedServerStates: (): SystemState => ({
    ...createBaseSystemState(),
    targetServers_new: [
      createMockServer({
        name: "server-connected",
        state: "connected",
        isActive: true,
      }),
      createMockServer({ name: "server-pending", state: "pending-auth" }),
      createMockServer({ name: "server-failed", state: "connection-failed" }),
    ],
    connectedClients: [],
    connectedClientClusters: [],
  }),

  serversWithManyTools: createSystemState({
    serverCount: 2,
    serverConfig: { toolCount: 10 },
  }),
};
