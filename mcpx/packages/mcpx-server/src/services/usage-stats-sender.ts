import { Logger } from "winston";
import { hashObject } from "@mcpx/toolkit-core/data";
import {
  WebappBoundPayloadOf,
  wrapInEnvelope,
  EnvelopedMessage,
  UsageStatsPromptMessage,
  UsageStatsTargetServerInput,
} from "@mcpx/webapp-protocol/messages";
import { SystemState, TargetServer } from "@mcpx/shared-model";
import type { PromptMessage } from "@modelcontextprotocol/sdk/types.js";

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
    consumerTag: client.consumerTag,
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
    prompts: buildPromptsRecord(server),
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

function buildPromptsRecord(
  server: SystemState["targetServers"][number],
): UsageStatsTargetServerInput["prompts"] {
  if (!server.prompts) return {};
  return Object.fromEntries(
    server.prompts.map((prompt) => [
      prompt.name,
      {
        description: prompt.description,
        arguments: prompt.arguments,
        messages: stripPromptMessages(prompt.messages),
        usage: {
          callCount: prompt.usage.callCount,
          lastCalledAt: prompt.usage.lastCalledAt?.toISOString(),
        },
      },
    ]),
  );
}

// Per-message text cap, so one huge template can't push the payload past the
// socket limit (which drops ALL stats).
const MAX_PROMPT_TEXT_LENGTH = 20_000;

function capText(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  return text.length > MAX_PROMPT_TEXT_LENGTH
    ? `${text.slice(0, MAX_PROMPT_TEXT_LENGTH)}… (truncated)`
    : text;
}

// Persisted downstream, so drop base64 media `data` (only text renders). Text is
// capped; resource text is kept, its blob dropped.
function stripPromptMessages(
  messages: PromptMessage[] | undefined,
): UsageStatsPromptMessage[] | undefined {
  if (!messages) return undefined;
  return messages.map((message) => {
    const { role, content } = message;
    if (content.type === "text") {
      return { role, content: { type: "text", text: capText(content.text) } };
    }
    if (content.type === "resource") {
      const resource = content.resource;
      return {
        role,
        content: {
          type: "resource",
          text: "text" in resource ? capText(resource.text) : undefined,
          mimeType: resource.mimeType,
        },
      };
    }
    return {
      role,
      content: {
        type: content.type,
        mimeType: "mimeType" in content ? content.mimeType : undefined,
      },
    };
  });
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
