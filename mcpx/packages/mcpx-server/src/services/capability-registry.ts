import { Prompt, Tool } from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "winston";
import { env } from "../env.js";
import { safeEmit } from "./capability-notifications.js";

// "internal": handled in-process by mcpx (e.g. dynamic-capabilities, OAuth
// auth tools). "upstream": proxied to an external MCP server. Determines
// gateway dispatch. Per-capability because a single server (e.g. an
// OAuth-protected upstream) holds a mix — its upstream tools plus an internal
// auth tool.
export type CapabilityOrigin = "internal" | "upstream";

export type CapabilityKind = "tools" | "prompts";

// Single source of truth for which capability kinds mcpx currently exposes.
// `tools` is always on; `prompts` rides the rollout flag. Both the gateway's
// advertised capabilities and the list-changed broadcasts derive from this, so
// adding a kind (e.g. resources) is one edit here.
export function enabledCapabilityKinds(): CapabilityKind[] {
  return env.ENABLE_PROMPT_CAPABILITY ? ["tools", "prompts"] : ["tools"];
}

export interface RegisteredCapability<TDefinition> {
  definition: TDefinition;
  origin: CapabilityOrigin;
}

export type RegisteredTool = RegisteredCapability<Tool>;
export type RegisteredPrompt = RegisteredCapability<Prompt>;

export type ServerCapabilities = {
  tools?: RegisteredTool[];
  // Extended child tool name → original parent tool name.
  toolParentNames?: Record<string, string>;
  prompts?: RegisteredPrompt[];
};

// Tag flat lists with a single origin (upstream-handler for proxied,
// dynamic-capabilities for in-process).
export function tagTools(
  tools: Tool[],
  origin: CapabilityOrigin,
): RegisteredTool[] {
  return tools.map((definition) => ({ definition, origin }));
}

export function tagPrompts(
  prompts: Prompt[],
  origin: CapabilityOrigin,
): RegisteredPrompt[] {
  return prompts.map((definition) => ({ definition, origin }));
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
      promptCount: capabilities.prompts?.length ?? 0,
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
