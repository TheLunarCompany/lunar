import {
  accessLogFor,
  buildLogger,
  loggableError,
} from "@mcpx/toolkit-core/logging";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import express from "express";
import { createServer, Server } from "http";
import { Logger } from "winston";
import { ConfigManager } from "../src/config.js";
import { Config, TargetServer } from "../src/model.js";
import { AuthGuard, noOpAuthGuard } from "../src/server/auth.js";
import { buildSSERouter } from "../src/server/sse.js";
import { buildStreamableHttpRouter } from "../src/server/streamable.js";
import { Services } from "../src/services/services.js";
import {
  TESTKIT_SERVER_CALCULATOR,
  TESTKIT_SERVER_ECHO,
} from "../src/testkit/root.js";

const MCPX_PORT = 9000;

const getTestLogger: () => Logger = () =>
  buildLogger({ logLevel: "debug", label: "test" });
export const getMcpxLogger: () => Logger = () =>
  buildLogger({ logLevel: "debug", label: "mcpx" });

const BASE_CONFIG: Config = {
  permissions: { base: "allow", consumers: {} },
  toolGroups: [],
  auth: { enabled: false },
  toolExtensions: { services: {} },
};
export function buildConfig(props: Partial<Config> = {}): ConfigManager {
  const { auth, permissions, toolGroups, toolExtensions } = {
    ...BASE_CONFIG,
    ...props,
  };
  return new ConfigManager({ permissions, toolGroups, auth, toolExtensions });
}

const allTargetServers: TargetServer[] = [
  {
    name: "echo-service",
    command: "node",
    args: [TESTKIT_SERVER_ECHO],
    env: {},
  },
  {
    name: "calculator-service",
    command: "node",
    args: [TESTKIT_SERVER_CALCULATOR],
    env: {},
  },
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
    public testLogger: Logger,
    private clientConnectExtraHeaders: Record<string, string> = {},
  ) {}

  async initialize(transportType: TransportType): Promise<void> {
    // Setup MCPX
    await this.services.initialize();
    await Promise.all(
      allTargetServers.map((target) =>
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
                  ...init.headers,
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
  config?: ConfigManager;
  authGuard?: AuthGuard;
  mcpxLogger?: Logger;
  clientConnectExtraHeaders?: Record<string, string>;
}
function defaultTestHarnessProps(): Required<TestHarnessProps> {
  return {
    config: buildConfig(),
    authGuard: noOpAuthGuard,
    mcpxLogger: getMcpxLogger(),
    clientConnectExtraHeaders: {},
  };
}
export function getTestHarness(props: TestHarnessProps = {}): TestHarness {
  // the effective values are the defaults, unless overridden by props
  const { config, authGuard, mcpxLogger, clientConnectExtraHeaders } = {
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
  const app = express();
  const httpServer = createServer(app);
  app.use(express.json());
  app.use(accessLogFor(mcpxLogger));
  app.use(sseRouter);
  app.use(streamableRouter);

  return new TestHarness(
    client,
    httpServer,
    services,
    testLogger,
    clientConnectExtraHeaders,
  );
}
