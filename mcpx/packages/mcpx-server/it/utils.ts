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
import { buildControlPlaneRouter } from "../src/server/control-plane.js";
import { Services } from "../src/services/services.js";
import {
  TESTKIT_SERVER_CALCULATOR,
  TESTKIT_SERVER_ECHO,
} from "../src/testkit/root.js";

const MCPX_PORT = 9000;

const getTestLogger: () => LunarLogger = () =>
  buildLogger({ logLevel: "debug", label: "test" });
export const getMcpxLogger: () => LunarLogger = () =>
  buildLogger({ logLevel: "debug", label: "mcpx" });

const BASE_CONFIG: Config = {
  permissions: {
    default: { _type: "default-allow", block: [] },
    consumers: {},
  },
  toolGroups: [],
  auth: { enabled: false },
  toolExtensions: { services: {} },
};
export function buildConfig(props: Partial<Config> = {}): ConfigService {
  const { auth, permissions, toolGroups, toolExtensions } = {
    ...BASE_CONFIG,
    ...props,
  };
  return new ConfigService(
    { permissions, toolGroups, auth, toolExtensions },
    getMcpxLogger(),
  );
}

export const stdioTargetServers: TargetServer[] = [
  {
    type: "stdio",
    name: "echo-service",
    command: "node",
    args: [TESTKIT_SERVER_ECHO],
    env: {},
  },
  {
    type: "stdio",
    name: "calculator-service",
    command: "node",
    args: [TESTKIT_SERVER_CALCULATOR],
    env: {},
  },
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
  constructor(
    public client: Client,
    public server: Server,
    public services: Services,
    public testLogger: LunarLogger,
    private clientConnectExtraHeaders: Record<string, string> = {},
    private targetServers: TargetServer[] = stdioTargetServers,
  ) {}

  async initialize(transportType: TransportType): Promise<void> {
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
    this.services.shutdown();
    this.server.close(() => this.testLogger.info("Test MCPX server closed"));
    getTestLogger().close();
    getMcpxLogger().close();
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
  const meterProvider = new MeterProvider();
  const services = new Services(config, meterProvider, testLogger);

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
  const app = express();
  const httpServer = createServer(app);
  app.use(express.json());
  app.use(accessLogFor(mcpxLogger));
  app.use(sseRouter);
  app.use(streamableRouter);
  app.use(controlPlaneRouter);

  return new TestHarness(
    client,
    httpServer,
    services,
    testLogger,
    clientConnectExtraHeaders,
    targetServers,
  );
}
