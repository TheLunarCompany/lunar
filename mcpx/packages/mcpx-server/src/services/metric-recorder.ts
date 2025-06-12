import { SystemState } from "@mcpx/shared-model/api";
import { Clock } from "../utils/time.js";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { Logger } from "winston";

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
  connectedClientsBySessionId: Map<string, InternalConnectedClient>;
  usage: InternalUsage;
  lastUpdatedAt: Date;
}

interface InternalTargetServer {
  toolsByName: Map<string, InternalTargetServerTool>;
  usage: InternalUsage;
}

interface InternalConnectedClient {
  usage: InternalUsage;
  consumerTag?: string;
  llm?: {
    provider?: string;
    modelId?: string;
  };
}

interface InternalTargetServerTool {
  usage: InternalUsage;
  description?: string;
}

export class MetricRecorder {
  private clock: Clock;
  private state: InternalMcpxInstance;
  private logger: Logger;
  private listeners = new Set<(snapshot: SystemState) => void>();
  private toolCallDurationHistogram: ReturnType<
    ReturnType<MeterProvider["getMeter"]>["createHistogram"]
  >;

  constructor(clock: Clock, logger?: Logger) {
    this.clock = clock;
    const noopLogger: Logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      log: () => {},
    } as unknown as Logger;

    this.logger = logger ?? noopLogger;

    this.state = {
      targetServersByName: new Map(),
      connectedClientsBySessionId: new Map(),
      usage: new InternalUsage(),
      lastUpdatedAt: this.clock.now(),
    };

    const port = process.env["SERVE_METRICS_PORT"]
      ? Number(process.env["SERVE_METRICS_PORT"])
      : 3000;

    // Metrics setup (one-time, in this class)
    let exporter: PrometheusExporter | undefined = undefined;
    try {
      exporter = new PrometheusExporter({
        port,
        endpoint: "/metrics",
      });

      // The underlying HTTP server is at exporter['_server']
      const server = (
        exporter as unknown as { _server?: import("http").Server }
      )._server;
      let started = false;

      if (server) {
        server.on("listening", () => {
          started = true;
          this.logger.info(`Metrics endpoint started on port ${port}`, {
            component: "metrics",
          });
        });
        server.on("error", (err: Error) => {
          if (!started) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `Metrics endpoint failed to start on port ${port}: ${errorMsg}`,
              { component: "metrics" },
            );
          }
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Metrics endpoint failed to start on port ${port}: ${errorMsg}`,
        { component: "metrics" },
      );
    }
    const meterProvider = new MeterProvider({
      readers: exporter ? [exporter] : [],
    });
    const meter = meterProvider.getMeter("mcpx-server");
    this.toolCallDurationHistogram = meter.createHistogram(
      "tool_call_duration_ms",
      {
        description: "Duration of tool calls in ms",
        unit: "ms",
      },
    );
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
    const targetServers = Array.from(
      this.state.targetServersByName.entries(),
    ).map(([name, server]) => ({
      name,
      tools: Array.from(server.toolsByName.entries()).map(
        ([toolName, tool]) => ({
          name: toolName,
          usage: tool.usage,
          description: tool.description,
        }),
      ),
      usage: server.usage,
    }));

    const connectedClients = Array.from(
      this.state.connectedClientsBySessionId.entries(),
    ).map(([sessionId, client]) => ({
      sessionId,
      usage: client.usage,
      consumerTag: client.consumerTag,
      llm: client.llm,
    }));

    return {
      targetServers,
      connectedClients,
      usage: this.state.usage,
      lastUpdatedAt: this.state.lastUpdatedAt,
    };
  }

  public recordToolCallDuration(
    durationMs: number,
    labels: Record<string, string>,
  ): void {
    this.toolCallDurationHistogram.record(durationMs, labels);
  }

  recordTargetServerConnected(targetServer: {
    name: string;
    tools: { name: string; description?: string }[];
  }): void {
    const current = this.state.targetServersByName.get(targetServer.name);
    if (!current) {
      this.state.targetServersByName.set(targetServer.name, {
        toolsByName: new Map(
          targetServer.tools.map((tool) => [
            tool.name,
            { usage: new InternalUsage(), description: tool.description },
          ]),
        ),
        usage: new InternalUsage(),
      });
    }
    this.state.lastUpdatedAt = this.clock.now();
    this.notifyListeners();
  }

  recordTargetServerDisconnected(targetServer: { name: string }): void {
    this.state.targetServersByName.delete(targetServer.name);
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

    const server = this.state.targetServersByName.get(call.targetServerName);
    if (!server) {
      return;
    }
    server.usage.increment({ now });

    const tool = server.toolsByName.get(call.toolName);
    if (!tool) {
      return;
    }
    tool.usage.increment({ now });

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
}
