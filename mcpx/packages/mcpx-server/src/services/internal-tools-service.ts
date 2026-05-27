import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "winston";
import { ToolCallResultUnion } from "../model/sessions.js";
import {
  CapabilityRegistry,
  ServerCapabilities,
} from "./capability-registry.js";
import { ActiveTool, ConsumerContext } from "./capability-resolver.js";

// Plugin contract for an origin="internal" tool. Each owning service supplies
// one handler per tool; the gateway dispatches by tool name without knowing
// which service owns it.
//
// `isVisible` receives the resolved capability so handlers that exist under
// multiple server names (e.g. the OAuth auth tool, one per server) can decide
// per-instance — typically by consulting the permission manager.
export interface InternalToolHandler {
  readonly toolName: string;
  isVisible(consumer: ConsumerContext, cap: ActiveTool): boolean;
  enrich?(definition: Tool): Tool;
  handle(input: {
    serverName: string;
    args: Record<string, unknown>;
    consumer: ConsumerContext;
  }): Promise<ToolCallResultUnion>;
}

export interface InternalCapabilityRegistration {
  serverName: string;
  capabilities: ServerCapabilities;
}

export interface InternalCapabilityProvider {
  getInternalCapabilityRegistrations(): {
    handlers: InternalToolHandler[];
    eagerRegistrations: InternalCapabilityRegistration[];
  };
}

export function wireInternalCapabilityProvider(
  provider: InternalCapabilityProvider,
  internalTools: InternalToolsService,
  registry: CapabilityRegistry,
): void {
  const { handlers, eagerRegistrations } =
    provider.getInternalCapabilityRegistrations();
  for (const handler of handlers) {
    internalTools.register(handler);
  }
  for (const reg of eagerRegistrations) {
    for (const tool of reg.capabilities.tools ?? []) {
      if (tool.origin !== "internal") continue;
      if (!internalTools.hasHandler(tool.definition.name)) {
        throw new Error(
          `Internal capability "${tool.definition.name}" registered for server "${reg.serverName}" has no handler`,
        );
      }
    }
    registry.registerServer(reg.serverName, reg.capabilities);
  }
}

export class InternalToolsService {
  private readonly handlers = new Map<string, InternalToolHandler>();
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: "InternalToolsService" });
  }

  register(handler: InternalToolHandler): void {
    if (this.handlers.has(handler.toolName)) {
      throw new Error(`Internal tool already registered: ${handler.toolName}`);
    }
    this.handlers.set(handler.toolName, handler);
  }

  hasHandler(toolName: string): boolean {
    return this.handlers.has(toolName);
  }

  visibleForListing(
    cap: ActiveTool,
    consumer: ConsumerContext,
  ): Tool | undefined {
    const handler = this.handlers.get(cap.capabilityName);
    if (!handler) {
      this.logger.warn(
        "Internal capability registered without a handler — hidden from ListTools",
        { serverName: cap.serverName, capabilityName: cap.capabilityName },
      );
      return undefined;
    }
    if (!handler.isVisible(consumer, cap)) return undefined;
    return handler.enrich?.(cap.definition) ?? cap.definition;
  }

  async dispatch(
    entry: ActiveTool,
    args: Record<string, unknown>,
    consumer: ConsumerContext,
  ): Promise<ToolCallResultUnion> {
    const handler = this.handlers.get(entry.capabilityName);
    if (!handler) {
      throw new UnknownInternalToolError(entry.capabilityName);
    }
    if (!handler.isVisible(consumer, entry)) {
      throw new HiddenInternalToolError(entry.capabilityName);
    }
    return handler.handle({
      serverName: entry.serverName,
      args,
      consumer,
    });
  }
}

export class UnknownInternalToolError extends Error {
  constructor(toolName: string) {
    super(`Unknown internal tool: ${toolName}`);
    this.name = "UnknownInternalToolError";
  }
}

export class HiddenInternalToolError extends Error {
  constructor(toolName: string) {
    super(`Internal tool not available: ${toolName}`);
    this.name = "HiddenInternalToolError";
  }
}
