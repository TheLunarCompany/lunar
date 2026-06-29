import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "winston";
import { ToolCallResultUnion } from "../model/sessions.js";
import {
  CapabilityKind,
  CapabilityRegistry,
  ServerCapabilities,
} from "./capability-registry.js";
import { ActiveTool, ConsumerContext } from "./capability-resolver.js";

// Plugin contract for an origin="internal" capability. Each handler is tagged
// with its kind so the service can grow to dispatch additional capability
// kinds without changing this contract.
export interface InternalToolHandler {
  readonly kind: "tools";
  readonly name: string;
  isVisible(consumer: ConsumerContext, cap: ActiveTool): boolean;
  enrich?(definition: Tool): Tool;
  handle(input: {
    serverName: string;
    args: Record<string, unknown>;
    consumer: ConsumerContext;
  }): Promise<ToolCallResultUnion>;
}

export type InternalCapabilityHandler = InternalToolHandler;

export interface InternalCapabilityRegistration {
  serverName: string;
  capabilities: ServerCapabilities;
}

export interface InternalCapabilityProvider {
  getInternalCapabilityRegistrations(): {
    handlers: InternalCapabilityHandler[];
    eagerRegistrations: InternalCapabilityRegistration[];
  };
}

export function wireInternalCapabilityProvider(
  provider: InternalCapabilityProvider,
  internalCapabilities: InternalCapabilitiesService,
  registry: CapabilityRegistry,
): void {
  const { handlers, eagerRegistrations } =
    provider.getInternalCapabilityRegistrations();
  for (const handler of handlers) {
    internalCapabilities.register(handler);
  }
  for (const reg of eagerRegistrations) {
    for (const tool of reg.capabilities.tools ?? []) {
      if (tool.origin !== "internal") continue;
      if (!internalCapabilities.hasHandler("tools", tool.definition.name)) {
        throw new Error(
          `Internal capability "${tool.definition.name}" registered for server "${reg.serverName}" has no handler`,
        );
      }
    }
    registry.registerServer(reg.serverName, reg.capabilities);
  }
}

export class InternalCapabilitiesService {
  private readonly toolHandlers = new Map<string, InternalToolHandler>();
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: "InternalCapabilitiesService" });
  }

  register(handler: InternalCapabilityHandler): void {
    if (this.toolHandlers.has(handler.name)) {
      throw new Error(`Internal tools already registered: ${handler.name}`);
    }
    this.toolHandlers.set(handler.name, handler);
  }

  hasHandler(kind: CapabilityKind, name: string): boolean {
    if (kind !== "tools") return false;
    return this.toolHandlers.has(name);
  }

  visibleToolForListing(
    cap: ActiveTool,
    consumer: ConsumerContext,
  ): Tool | undefined {
    const handler = this.toolHandlers.get(cap.capabilityName);
    if (!handler) {
      this.logDriftMiss("tools", cap.serverName, cap.capabilityName);
      return undefined;
    }
    if (!handler.isVisible(consumer, cap)) return undefined;
    return handler.enrich?.(cap.definition) ?? cap.definition;
  }

  async dispatchTool(
    entry: ActiveTool,
    args: Record<string, unknown>,
    consumer: ConsumerContext,
  ): Promise<ToolCallResultUnion> {
    const handler = this.toolHandlers.get(entry.capabilityName);
    if (!handler)
      throw new UnknownInternalCapabilityError(entry.capabilityName);
    if (!handler.isVisible(consumer, entry)) {
      throw new HiddenInternalCapabilityError(entry.capabilityName);
    }
    return handler.handle({
      serverName: entry.serverName,
      args,
      consumer,
    });
  }

  private logDriftMiss(
    kind: CapabilityKind,
    serverName: string,
    capabilityName: string,
  ): void {
    this.logger.warn(
      `Internal ${kind} registered without a handler — hidden from listing`,
      { serverName, capabilityName },
    );
  }
}

export class UnknownInternalCapabilityError extends Error {
  constructor(capabilityName: string) {
    super(`Unknown internal capability: ${capabilityName}`);
    this.name = "UnknownInternalCapabilityError";
  }
}

export class HiddenInternalCapabilityError extends Error {
  constructor(capabilityName: string) {
    super(`Internal capability not available: ${capabilityName}`);
    this.name = "HiddenInternalCapabilityError";
  }
}
