import { Logger } from "winston";
import { hashObject } from "@mcpx/toolkit-core/data";
import {
  WebappBoundPayloadOf,
  wrapInEnvelope,
  EnvelopedMessage,
  UsageStatsTargetServerInput,
} from "@mcpx/webapp-protocol/messages";
import { SystemState, TargetServer } from "@mcpx/shared-model";

type ReportableTargetServer = TargetServer & {
  state: Exclude<TargetServer["state"], { type: "connecting" }>;
};

// "connecting" is a transient UI-only state with no meaningful usage data,
// and the hub's zod schema doesn't accept it — so we skip these servers.
function isReportableTargetServer(
  server: TargetServer,
): server is ReportableTargetServer {
  return server.state.type !== "connecting";
}

export interface UsageStatsSocket {
  emit(
    event: "usage-stats",
    data: EnvelopedMessage<WebappBoundPayloadOf<"usage-stats">>,
  ): void;
}

export class UsageStatsSender {
  private intervalId: NodeJS.Timeout | null = null;
  private lastPayloadHash: string | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly getUsageStats: () => WebappBoundPayloadOf<"usage-stats">,
    private readonly intervalMs: number,
  ) {}

  start(socket: UsageStatsSocket): void {
    this.stop();
    this.sendIfChanged(socket);
    this.intervalId = setInterval(() => {
      this.sendIfChanged(socket);
    }, this.intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.lastPayloadHash = null;
  }

  sendNow(socket: UsageStatsSocket): void {
    this.sendIfChanged(socket);
  }

  private sendIfChanged(socket: UsageStatsSocket): void {
    const payload = this.getUsageStats();
    const payloadHash = this.hashPayload(payload);

    if (payloadHash === this.lastPayloadHash) {
      return;
    }

    const envelopedMessage = wrapInEnvelope({ payload });
    this.logger.debug("Sending usage stats to Hub", {
      messageId: envelopedMessage.metadata.id,
    });
    socket.emit("usage-stats", envelopedMessage);
    this.lastPayloadHash = payloadHash;
  }

  private hashPayload(payload: WebappBoundPayloadOf<"usage-stats">): string {
    return hashObject(payload);
  }
}

export function buildUsageStatsPayload(
  state: SystemState,
): WebappBoundPayloadOf<"usage-stats"> {
  const agents = state.connectedClients.map((client) => ({
    clientInfo: {
      protocolVersion: client.clientInfo?.protocolVersion,
      name: client.clientInfo?.name,
      version: client.clientInfo?.version,
    },
  }));

  const targetServers = state.targetServers
    .filter(isReportableTargetServer)
    .map(buildTargetServerPayload);

  return { agents, targetServers };
}

function buildTargetServerPayload(
  server: ReportableTargetServer,
): UsageStatsTargetServerInput {
  const base = {
    name: server.name,
    status: server.state.type,
    tools: buildToolsRecord(server),
  };

  if (server._type === "stdio") {
    return {
      ...base,
      type: "stdio",
      missingEnvVars:
        server.state.type === "pending-input"
          ? server.state.missingEnvVars
          : undefined,
    };
  }

  return { ...base, type: server._type };
}

function buildToolsRecord(
  server: SystemState["targetServers"][number],
): UsageStatsTargetServerInput["tools"] {
  const originalToolNames = new Set(
    server.originalTools.map((tool) => tool.name),
  );

  return Object.fromEntries(
    server.tools.map((tool) => [
      tool.name,
      {
        description: tool.description,
        parameters: tool.parameters,
        isCustom: !originalToolNames.has(tool.name),
        estimatedTokens: tool.estimatedTokens,
        usage: {
          callCount: tool.usage.callCount,
          lastCalledAt: tool.usage.lastCalledAt?.toISOString(),
        },
      },
    ]),
  );
}
