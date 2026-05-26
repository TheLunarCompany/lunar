import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "winston";
import { safeEmit } from "./capability-notifications.js";

// "internal": handled in-process by mcpx (e.g. dynamic-capabilities, OAuth
// auth tools). "upstream": proxied to an external MCP server. Determines
// gateway dispatch. Per-capability because a single server (e.g. an
// OAuth-protected upstream) holds a mix — its upstream tools plus an internal
// auth tool.
export type CapabilityOrigin = "internal" | "upstream";

export type CapabilityKind = "tools";

export interface RegisteredCapability<TDefinition> {
  definition: TDefinition;
  origin: CapabilityOrigin;
}

export type RegisteredTool = RegisteredCapability<Tool>;

export type ServerCapabilities = {
  tools?: RegisteredTool[];
  // Extended child tool name → original parent tool name.
  toolParentNames?: Record<string, string>;
};

// Convenience: tag a flat Tool[] with a single origin. Used by callers whose
// tools all share an origin (upstream-handler for proxied tools,
// dynamic-capabilities for in-process tools).
export function tagTools(
  tools: Tool[],
  origin: CapabilityOrigin,
): RegisteredTool[] {
  return tools.map((definition) => ({ definition, origin }));
}

type ChangeListener = () => void | Promise<void>;
type Unsubscribe = () => void;

// Physical-reality plane: which servers are connected and what they advertise.
// Admin policy (inactive servers, catalog approval) and per-consumer permissions
// are layered on top by CapabilityResolver.
export class CapabilityRegistry {
  private readonly _servers = new Map<string, ServerCapabilities>();
  private readonly listeners = new Set<ChangeListener>();
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: "CapabilityRegistry" });
  }

  get servers(): ReadonlyMap<string, ServerCapabilities> {
    return this._servers;
  }

  registerServer(serverName: string, capabilities: ServerCapabilities): void {
    this._servers.set(serverName, capabilities);
    this.logger.debug("Server registered", {
      serverName,
      toolCount: capabilities.tools?.length ?? 0,
    });
    this.notify();
  }

  unregisterServer(serverName: string): void {
    if (!this._servers.delete(serverName)) return;
    this.notify();
    this.logger.debug("Server unregistered", { serverName });
  }

  onChanged(callback: ChangeListener): Unsubscribe {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  shutdown(): void {
    this.listeners.clear();
  }

  private notify(): void {
    safeEmit(
      this.listeners,
      (cb) => cb(),
      this.logger,
      "CapabilityRegistry listener threw",
    );
  }
}
