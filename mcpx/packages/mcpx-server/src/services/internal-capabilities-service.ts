import {
  GetPromptResult,
  ReadResourceResult,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "winston";
import { ToolCallResultUnion } from "../model/sessions.js";
import {
  CapabilityKind,
  CapabilityRegistry,
  ServerCapabilities,
} from "./capability-registry.js";
import {
  ActivePrompt,
  ActiveResource,
  ActiveTool,
  ConsumerContext,
} from "./capability-resolver.js";

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

export interface ResourceContent {
  mimeType: string;
  text: string;
}

// One reader for a whole server's resources (a per-server repository): keyed by
// the server it owns, it reads any of that server's uris. Unlike tools (one
// bespoke handler per name), a server's resources share one read behavior over
// data.
export interface InternalResourceHandler {
  readonly kind: "resources";
  readonly serverName: string;
  read(uri: string): ResourceContent | undefined;
}

// Like the resource handler: one getter for a whole server's prompts, keyed by
// serverName. `name` is the real (unprefixed) prompt name.
export interface InternalPromptHandler {
  readonly kind: "prompts";
  readonly serverName: string;
  getPrompt(name: string): GetPromptResult | undefined;
}

export type InternalCapabilityHandler =
  | InternalToolHandler
  | InternalResourceHandler
  | InternalPromptHandler;

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
  // Keyed by serverName: one resource repository per resource-owning server.
  private readonly resourceHandlers = new Map<
    string,
    InternalResourceHandler
  >();
  // Keyed by serverName: one prompt getter per prompt-owning server.
  private readonly promptHandlers = new Map<string, InternalPromptHandler>();
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: "InternalCapabilitiesService" });
  }

  register(handler: InternalCapabilityHandler): void {
    switch (handler.kind) {
      case "tools":
        if (this.toolHandlers.has(handler.name)) {
          throw new Error(`Internal tool already registered: ${handler.name}`);
        }
        this.toolHandlers.set(handler.name, handler);
        return;
      case "resources":
        if (this.resourceHandlers.has(handler.serverName)) {
          throw new Error(
            `Internal resource handler already registered: ${handler.serverName}`,
          );
        }
        this.resourceHandlers.set(handler.serverName, handler);
        return;
      case "prompts":
        if (this.promptHandlers.has(handler.serverName)) {
          throw new Error(
            `Internal prompt handler already registered: ${handler.serverName}`,
          );
        }
        this.promptHandlers.set(handler.serverName, handler);
        return;
    }
  }

  hasHandler(kind: CapabilityKind, name: string): boolean {
    switch (kind) {
      case "tools":
        return this.toolHandlers.has(name);
      case "resources":
        return this.resourceHandlers.has(name);
      case "prompts":
        return this.promptHandlers.has(name);
    }
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

  // The owning server's repository reads any of its uris. Visibility was already
  // gated by resolveResourceRead, same as dispatchTool.
  dispatchResource(entry: ActiveResource): ReadResourceResult | undefined {
    const handler = this.resourceHandlers.get(entry.serverName);
    if (!handler) {
      throw new UnknownInternalCapabilityError(entry.serverName);
    }
    const content = handler.read(entry.capabilityName);
    if (!content) return undefined;
    // Echo the advertised uri (what the client requested), not the real one.
    return { contents: [{ uri: entry.definition.uri, ...content }] };
  }

  dispatchPrompt(entry: ActivePrompt): GetPromptResult | undefined {
    const handler = this.promptHandlers.get(entry.serverName);
    if (!handler) {
      throw new UnknownInternalCapabilityError(entry.serverName);
    }
    return handler.getPrompt(entry.capabilityName);
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
