import {
  accessLogFor,
  buildLogger,
  loggableError,
  LunarLogger,
} from "@mcpx/toolkit-core/logging";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import express from "express";
import { createServer, Server } from "http";
import { ConfigService } from "../src/config.js";
import { Config } from "../src/model/config/config.js";
import { TargetServer } from "../src/model/target-servers.js";
import { AuthGuard, noOpAuthGuard } from "../src/server/auth.js";
import { buildSSERouter } from "../src/server/sse.js";
import { buildStreamableHttpRouter } from "../src/server/streamable.js";
import { buildControlPlaneAppConfigRouter } from "../src/server/control-plane-app-config.js";
import { buildControlPlaneRouter } from "../src/server/control-plane.js";
import { Services } from "../src/services/services.js";
import {
  TESTKIT_SERVER_CALCULATOR,
  TESTKIT_SERVER_ECHO,
} from "../src/testkit/root.js";
import { MockHubServer } from "./mock-hub-server.js";
import { buildCatalogRouter } from "../src/server/servers-catalog.js";

const MCPX_PORT = 9000;
let nextHubPort = 3030; // Start from 3030 and increment for each harness

// Track all created loggers for cleanup
const allLoggers = new Set<LunarLogger>();

const getTestLogger: () => LunarLogger = () => {
  const logger = buildLogger({ logLevel: "debug", label: "test" });
  allLoggers.add(logger);
  return logger;
};

export const getMcpxLogger: () => LunarLogger = () => {
  const logger = buildLogger({ logLevel: "debug", label: "mcpx" });
  allLoggers.add(logger);
  return logger;
};

// Cleanup function to close all logger instances (for global teardown)
export const closeAllLoggers = (): void => {
  allLoggers.forEach((logger) => {
    try {
      logger.close();
    } catch (_e) {
      // Ignore errors when closing loggers
    }
  });
  allLoggers.clear();
};

const BASE_CONFIG: Config = {
  permissions: {
    default: { _type: "default-allow", block: [] },
    consumers: {},
  },
  toolGroups: [],
  auth: { enabled: false },
  toolExtensions: { services: {} },
  targetServerAttributes: {},
};
export function buildConfig(props: Partial<Config> = {}): ConfigService {
  const {
    auth,
    permissions,
    toolGroups,
    toolExtensions,
    targetServerAttributes,
  } = {
    ...BASE_CONFIG,
    ...props,
  };
  return new ConfigService(
    { permissions, toolGroups, auth, toolExtensions, targetServerAttributes },
    getMcpxLogger(),
  );
}

export const echoTargetServer: TargetServer = {
  type: "stdio",
  name: "echo-service",
  command: "node",
  args: [TESTKIT_SERVER_ECHO],
  env: {},
};

export const calculatorTargetServer: TargetServer = {
  type: "stdio",
  name: "calculator-service",
  command: "node",
  args: [TESTKIT_SERVER_CALCULATOR],
  env: {},
};

export const stdioTargetServers: TargetServer[] = [
  echoTargetServer,
  calculatorTargetServer,
];

export const oauthTargetServer: TargetServer = {
  type: "streamable-http",
  name: "oauth-mock-server",
  url: "http://localhost:9001/mcp",
};
export const allTargetServers: TargetServer[] = [
  ...stdioTargetServers,
  oauthTargetServer,
];
type TransportType = "SSE" | "StreamableHTTP";

export const transportTypes: TransportType[] = [
  "SSE",
  "StreamableHTTP",
] as const;

export class TestHarness {
  public clientConnectError?: Error | undefined;
  private loggers: LunarLogger[] = [];
  public readonly mockHubServer: MockHubServer;

  constructor(
    public client: Client,
    public server: Server,
    public services: Services,
    public testLogger: LunarLogger,
    mockHubServer: MockHubServer,
    private clientConnectExtraHeaders: Record<string, string> = {},
    private targetServers: TargetServer[] = stdioTargetServers,
  ) {
    // Track loggers for this harness instance
    this.loggers.push(testLogger);
    this.mockHubServer = mockHubServer;
  }

  addLogger(logger: LunarLogger): void {
    this.loggers.push(logger);
  }

  async initialize(transportType: TransportType): Promise<void> {
    // Start mock Hub server first
    await this.mockHubServer.waitForListening();

    // Setup MCPX
    await this.services.initialize();
    await Promise.all(
      this.targetServers.map((target) =>
        this.services.targetClients.addClient(target),
      ),
    );
    await this.server.listen(MCPX_PORT, () => {
      this.testLogger.info(`Test MCPX server listening on port ${MCPX_PORT}`);
    });

    const transport = this.buildTransport(transportType);

    await this.client
      .connect(transport)
      .then(() => this.testLogger.info("End-client connected"))
      .catch((e) => {
        const error = loggableError(e);
        this.testLogger.error("Failed to connect end-client", error);
        this.clientConnectError = e;
      });
  }

  async shutdown(): Promise<void> {
    await this.client.transport?.close();
    await this.client.close();
    await this.services.shutdown();
    await new Promise<void>((resolve) => {
      this.server.close(() => {
        this.testLogger.info("Test MCPX server closed");
        resolve();
      });
    });
    // Close mock Hub server before closing loggers (disconnect events need to log)
    await this.mockHubServer.close();
    // Close loggers after all servers/sockets are fully closed
    this.loggers.forEach((logger) => {
      try {
        logger.close();
      } catch (_e) {
        // Ignore errors when closing loggers
      }
    });
    this.loggers = [];
  }

  private buildTransport(transportType: TransportType): Transport {
    switch (transportType) {
      case "SSE":
        return new SSEClientTransport(
          new URL(`http://localhost:${MCPX_PORT}/sse`),
          {
            eventSourceInit: {
              fetch: (url, init) => {
                const headers = new Headers({
                  ...init?.headers,
                  ...this.clientConnectExtraHeaders,
                });
                return fetch(url, { ...init, headers });
              },
            },
          },
        );
      case "StreamableHTTP":
        return new StreamableHTTPClientTransport(
          new URL(`http://localhost:${MCPX_PORT}/mcp`),
          {
            requestInit: {
              headers: this.clientConnectExtraHeaders,
            },
          },
        );
      default:
        throw new Error(`Unknown transport type: ${transportType}`);
    }
  }
}

interface TestHarnessProps {
  config?: ConfigService;
  authGuard?: AuthGuard;
  mcpxLogger?: LunarLogger;
  clientConnectExtraHeaders?: Record<string, string>;
  targetServers?: TargetServer[];
}
function defaultTestHarnessProps(): Required<TestHarnessProps> {
  return {
    config: buildConfig(),
    authGuard: noOpAuthGuard,
    mcpxLogger: getMcpxLogger(),
    clientConnectExtraHeaders: {},
    targetServers: stdioTargetServers,
  };
}
export function getTestHarness(props: TestHarnessProps = {}): TestHarness {
  // the effective values are the defaults, unless overridden by props
  const {
    config,
    authGuard,
    mcpxLogger,
    clientConnectExtraHeaders,
    targetServers,
  } = {
    ...defaultTestHarnessProps(),
    ...props,
  };
  const testLogger = getTestLogger();

  // Assign unique Hub port for this test harness
  const hubPort = nextHubPort++;

  const meterProvider = new MeterProvider();
  const services = new Services(config, meterProvider, testLogger, {
    hubUrl: `http://localhost:${hubPort}`,
  });

  const client = new Client({ name: "end-client", version: "1.0.0" });

  // Wire router on server
  const sseRouter = buildSSERouter(authGuard, services, mcpxLogger);
  const streamableRouter = buildStreamableHttpRouter(
    authGuard,
    services,
    mcpxLogger,
  );
  const controlPlaneRouter = buildControlPlaneRouter(
    authGuard,
    services,
    mcpxLogger,
  );
  const controlPlaneAppConfigRouter = buildControlPlaneAppConfigRouter(
    authGuard,
    services,
    mcpxLogger,
  );

  const catalogRouter = buildCatalogRouter(authGuard, services, mcpxLogger);

  const app = express();
  const httpServer = createServer(app);
  app.use(express.json());
  app.use(accessLogFor(mcpxLogger));
  app.use(sseRouter);
  app.use(streamableRouter);
  app.use(controlPlaneRouter);
  app.use("/config", controlPlaneAppConfigRouter);
  app.use("/catalog", catalogRouter);

  // Create mock Hub server for this test (port already assigned above)
  const mockHubServer = new MockHubServer({
    port: hubPort,
    logger: testLogger,
  });
  // Accept the test instance ID from .it.env
  mockHubServer.setValidTokens(["it-run"]);

  const harness = new TestHarness(
    client,
    httpServer,
    services,
    testLogger,
    mockHubServer,
    clientConnectExtraHeaders,
    targetServers,
  );

  // Track the mcpxLogger in this harness instance
  harness.addLogger(mcpxLogger);

  return harness;
}
