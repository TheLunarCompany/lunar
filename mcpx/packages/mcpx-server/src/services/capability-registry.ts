import {
  Prompt,
  PromptMessage,
  Resource,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "winston";
import { env } from "../env.js";
import { safeEmit } from "./capability-notifications.js";

// "internal": handled in-process by mcpx (e.g. dynamic-capabilities, OAuth
// auth tools). "upstream": proxied to an external MCP server. Determines
// gateway dispatch. Per-capability because a single server (e.g. an
// OAuth-protected upstream) holds a mix — its upstream tools plus an internal
// auth tool.
export type CapabilityOrigin = "internal" | "upstream";

export type CapabilityKind = "tools" | "prompts" | "resources";

// Single source of truth for which capability kinds mcpx currently exposes.
// `tools` is always on; `prompts` and `resources` ride their rollout flags. Both
// the gateway's advertised capabilities and the list-changed broadcasts derive
// from this.
export function enabledCapabilityKinds(): CapabilityKind[] {
  const kinds: CapabilityKind[] = ["tools"];
  if (env.ENABLE_PROMPT_CAPABILITY) kinds.push("prompts");
  if (env.ENABLE_RESOURCE_CAPABILITY) kinds.push("resources");
  return kinds;
}

export interface RegisteredCapability<TDefinition> {
  definition: TDefinition;
  origin: CapabilityOrigin;
}

export type RegisteredTool = RegisteredCapability<Tool>;
export type RegisteredPrompt = RegisteredCapability<Prompt>;
export type RegisteredResource = RegisteredCapability<Resource>;

export type ServerCapabilities = {
  tools?: RegisteredTool[];
  // Extended child tool name → original parent tool name.
  toolParentNames?: Record<string, string>;
  prompts?: RegisteredPrompt[];
  // Cached messages from prompts/get, fetched best-effort after discovery
  // and keyed by upstream prompt name. Missing entries mean the getPrompt
  // call failed (e.g. the prompt requires arguments we don't have at
  // discovery).
  promptMessages?: Record<string, PromptMessage[]>;
  // No content-preview cache (cf. promptMessages): resources are served from a
  // local source today, so a read costs no round-trip. Revisit when upstream
  // resources are supported.
  resources?: RegisteredResource[];
};

// Keep the promptMessages preview cache a subset of the current prompts, so a
// prompt that's no longer advertised can't leave an orphaned preview behind.
function reconcilePromptMessages(
  capabilities: ServerCapabilities,
): ServerCapabilities {
  const { promptMessages, prompts } = capabilities;
  if (!promptMessages) return capabilities;
  const names = new Set((prompts ?? []).map((p) => p.definition.name));
  return {
    ...capabilities,
    promptMessages: Object.fromEntries(
      Object.entries(promptMessages).filter(([name]) => names.has(name)),
    ),
  };
}

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

export function tagResources(
  resources: Resource[],
  origin: CapabilityOrigin,
): RegisteredResource[] {
  return resources.map((definition) => ({ definition, origin }));
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
    this._servers.set(serverName, reconcilePromptMessages(capabilities));
    this.logger.debug("Server registered", {
      serverName,
      toolCount: capabilities.tools?.length ?? 0,
      promptCount: capabilities.prompts?.length ?? 0,
      resourceCount: capabilities.resources?.length ?? 0,
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
