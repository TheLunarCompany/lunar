import { Logger } from "winston";
import { hashObject } from "@mcpx/toolkit-core/data";
import {
  WebappBoundPayloadOf,
  wrapInEnvelope,
  EnvelopedMessage,
  UsageStatsTargetServerInput,
} from "@mcpx/webapp-protocol/messages";
import { SystemState } from "@mcpx/shared-model";

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
      this.logger.debug("Usage stats unchanged, skipping send");
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

  const targetServers: Array<UsageStatsTargetServerInput> = [];

  for (const server of state.targetServers) {
    const originalToolNames = new Set(
      server.originalTools.map((tool) => tool.name),
    );

    targetServers.push({
      name: server.name,
      status: server.state.type,
      type: server._type,
      tools: Object.fromEntries(
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
      ),
    });
  }

  return {
    agents,
    targetServers,
  };
}
