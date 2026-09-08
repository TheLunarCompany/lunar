import { Prompt, Resource, Tool } from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "winston";
import { safeEmit } from "./capability-notifications.js";
import {
  CapabilityKind,
  CapabilityOrigin,
  CapabilityRegistry,
  RegisteredCapability,
  ServerCapabilities,
} from "./capability-registry.js";
import { CatalogChange, CatalogManagerI } from "./catalog-manager.js";
import { SERVICE_DELIMITER } from "./oauth-tools.js";

export interface ActiveCapability<Definition> {
  readonly serverName: string;
  readonly capabilityName: string;
  readonly definition: Definition;
  // Inherited from the registering server, so the gateway can dispatch
  // per-capability (internal → InternalCapabilitiesService, upstream → proxy).
  readonly origin: CapabilityOrigin;
}

export type ActiveTool = ActiveCapability<Tool>;
export type ActivePrompt = ActiveCapability<Prompt>;
export type ActiveResource = ActiveCapability<Resource>;

// Per-kind result of turning a raw definition into its active-set entry: the
// map key, the real (un-advertised) identity dispatch addresses, and the
// advertised definition the client sees.
interface ProjectedCapability<T> {
  key: string;
  capabilityName: string;
  definition: T;
}

export interface ConsumerContext {
  consumerTag?: string;
  clientName?: string;
  // Per-session isolation key for the Dynamic Capabilities engine (T03).
  sessionId?: string;
}

export interface PermissionCheck {
  hasPermission(props: {
    capabilityKind: CapabilityKind;
    serviceName: string;
    capabilityName: string;
    clientName?: string;
    consumerTag?: string;
  }): boolean;
}

// Set-once late binding for the resolver's permission source: wiring needs the
// resolver before the source can be constructed. initialize() completes the
// two-phase construction; checks before it are a wiring bug and throw.
// Once we fully migrate to Skills, this can be removed and construction simplified.
export class DeferredPermissionCheck implements PermissionCheck {
  private source?: PermissionCheck;

  initialize(source: PermissionCheck): void {
    if (this.source) {
      throw new Error("DeferredPermissionCheck is already initialized");
    }
    this.source = source;
  }

  hasPermission(
    props: Parameters<PermissionCheck["hasPermission"]>[0],
  ): boolean {
    if (!this.source) {
      throw new Error("DeferredPermissionCheck is not initialized");
    }
    return this.source.hasPermission(props);
  }
}

export type UnavailableReason =
  | "unknown"
  | "server-inactive"
  | "permission-denied";

export type ResolvedCapability<T> =
  | { ok: true; entry: ActiveCapability<T> }
  | { ok: false; reason: UnavailableReason };

export type ResolvedToolCall = ResolvedCapability<Tool>;
export type ResolvedPromptGet = ResolvedCapability<Prompt>;
export type ResolvedResourceRead = ResolvedCapability<Resource>;

type ChangeListener = (kind: CapabilityKind) => void | Promise<void>;
type Unsubscribe = () => void;

// Active capability set per kind = registry ∩ admin-active ∩ catalog approvals.
// Per-consumer permissions are layered on top via permittedCapabilities / allows.
export class CapabilityResolver {
  private _activeByKind: {
    tools: Map<string, ActiveTool>;
    prompts: Map<string, ActivePrompt>;
    resources: Map<string, ActiveResource>;
  } = {
    tools: new Map(),
    prompts: new Map(),
    resources: new Map(),
  };
  // Admin-suppressed server names. Independent of registry membership: setting
  // a name inactive before its server registers still suppresses it on arrival.
  private readonly inactiveNames = new Set<string>();
  private readonly listeners = new Set<ChangeListener>();
  private readonly unsubRegistry: Unsubscribe;
  private readonly unsubCatalog: Unsubscribe;
  private readonly logger: Logger;

  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly catalogManager: CatalogManagerI,
    private readonly permissions: PermissionCheck,
    logger: Logger,
  ) {
    this.logger = logger.child({ component: "CapabilityResolver" });
    this.unsubRegistry = registry.onChanged(() => this.recompute());
    this.unsubCatalog = catalogManager.subscribe((change) => {
      if (catalogChangeAffectsApprovals(change)) this.recompute();
    });
    this.recompute();
  }

  get activeTools(): ReadonlyMap<string, ActiveTool> {
    return this._activeByKind.tools;
  }

  get activePrompts(): ReadonlyMap<string, ActivePrompt> {
    return this._activeByKind.prompts;
  }

  get activeResources(): ReadonlyMap<string, ActiveResource> {
    return this._activeByKind.resources;
  }

  setInactiveServers(names: ReadonlySet<string>): void {
    if (setsEqual(this.inactiveNames, names)) return;
    this.inactiveNames.clear();
    for (const n of names) this.inactiveNames.add(n);
    this.recompute();
  }

  // Returns unprefixed definitions. Safe to call immediately after
  // registry.registerServer() because the registry's notify → recompute chain
  // runs synchronously.
  getApprovedToolsForServer(serverName: string): Tool[] {
    return approvedForServer(this.activeTools, serverName);
  }

  getApprovedPromptsForServer(serverName: string): Prompt[] {
    return approvedForServer(this.activePrompts, serverName);
  }

  getPermittedTools(consumer: ConsumerContext): ActiveTool[] {
    return this.permittedCapabilities(this.activeTools, "tools", consumer);
  }

  getPermittedPrompts(consumer: ConsumerContext): ActivePrompt[] {
    return this.permittedCapabilities(this.activePrompts, "prompts", consumer);
  }

  getPermittedResources(consumer: ConsumerContext): ActiveResource[] {
    return this.permittedCapabilities(
      this.activeResources,
      "resources",
      consumer,
    );
  }

  resolveToolCall(name: string, consumer: ConsumerContext): ResolvedToolCall {
    return this.resolve(this.activeTools, "tools", name, consumer);
  }

  resolvePromptGet(name: string, consumer: ConsumerContext): ResolvedPromptGet {
    return this.resolve(this.activePrompts, "prompts", name, consumer);
  }

  // Resources are keyed and resolved by uri, not a prefixed name.
  resolveResourceRead(
    uri: string,
    consumer: ConsumerContext,
  ): ResolvedResourceRead {
    return this.resolve(this.activeResources, "resources", uri, consumer);
  }

  onChanged(callback: ChangeListener): Unsubscribe {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  shutdown(): void {
    this.unsubRegistry();
    this.unsubCatalog();
    this.listeners.clear();
  }

  private recompute(): void {
    const prevTools = this._activeByKind.tools;
    const prevPrompts = this._activeByKind.prompts;
    const prevResources = this._activeByKind.resources;
    // Internal-origin capabilities bypass approval (mcpx-synthesized); they
    // dispatch through InternalCapabilitiesService which gates visibility.
    const nextTools = this.buildActiveSet<Tool>(
      (cap) => cap.tools,
      (def, serverName, cap, origin) =>
        origin === "internal" || this.isToolApproved(serverName, def.name, cap),
      prefixedProjection,
    );
    // Internal-origin prompts (skills projected as /slash) bypass approval, like
    // tools; upstream prompts are gated by `catalogManager.isPromptApproved`.
    const nextPrompts = this.buildActiveSet<Prompt>(
      (cap) => cap.prompts,
      (def, serverName, _cap, origin) =>
        origin === "internal" ||
        this.catalogManager.isPromptApproved(serverName, def.name),
      promptProjection,
    );
    // Only internal-origin resources are served; an upstream resource would
    // need its own approval branch before being included here.
    const nextResources = this.buildActiveSet<Resource>(
      (cap) => cap.resources,
      (_def, _serverName, _cap, origin) => origin === "internal",
      resourceProjection,
    );
    this._activeByKind.tools = nextTools;
    this._activeByKind.prompts = nextPrompts;
    this._activeByKind.resources = nextResources;
    if (!activeMapsEqual(prevTools, nextTools)) this.notify("tools");
    if (!activeMapsEqual(prevPrompts, nextPrompts)) this.notify("prompts");
    if (!activeMapsEqual(prevResources, nextResources)) {
      this.notify("resources");
    }
  }

  // `shouldInclude` encodes the per-kind inclusion rule; `project` encodes the
  // per-kind key + advertised identity (name-prefix for tools/prompts, uri
  // server-injection for resources, bare name for internal prompts). The loop is
  // identical across kinds.
  private buildActiveSet<T>(
    getItems: (
      cap: ServerCapabilities,
    ) => RegisteredCapability<T>[] | undefined,
    shouldInclude: (
      def: T,
      serverName: string,
      cap: ServerCapabilities,
      origin: CapabilityOrigin,
    ) => boolean,
    project: (
      def: T,
      serverName: string,
      origin: CapabilityOrigin,
    ) => ProjectedCapability<T>,
  ): Map<string, ActiveCapability<T>> {
    const result = new Map<string, ActiveCapability<T>>();
    for (const [serverName, capabilities] of this.registry.servers) {
      if (this.inactiveNames.has(serverName)) continue;
      for (const { definition, origin } of getItems(capabilities) ?? []) {
        if (!shouldInclude(definition, serverName, capabilities, origin)) {
          continue;
        }
        const projected = project(definition, serverName, origin);
        result.set(projected.key, {
          serverName,
          capabilityName: projected.capabilityName,
          definition: projected.definition,
          origin,
        });
      }
    }
    return result;
  }

  // Internal-origin capabilities bypass PermissionManager; the gateway gates
  // them via InternalCapabilitiesService handler.isVisible(consumer) on dispatch.
  private resolve<T>(
    source: ReadonlyMap<string, ActiveCapability<T>>,
    kind: CapabilityKind,
    name: string,
    consumer: ConsumerContext,
  ): ResolvedCapability<T> {
    const entry = source.get(name);
    if (!entry) return this.unresolved(name);
    if (entry.origin !== "internal" && !this.allows(entry, kind, consumer)) {
      return { ok: false, reason: "permission-denied" };
    }
    return { ok: true, entry };
  }

  // Distinguish "admin marked inactive" from "never existed".
  private unresolved(name: string): {
    ok: false;
    reason: UnavailableReason;
  } {
    const delim = name.indexOf(SERVICE_DELIMITER);
    const serverName = delim > 0 ? name.slice(0, delim) : "";
    if (
      serverName &&
      this.registry.servers.has(serverName) &&
      this.inactiveNames.has(serverName)
    ) {
      return { ok: false, reason: "server-inactive" };
    }
    return { ok: false, reason: "unknown" };
  }

  private isToolApproved(
    serverName: string,
    toolName: string,
    capabilities: ServerCapabilities,
  ): boolean {
    if (this.catalogManager.isToolApproved(serverName, toolName)) return true;
    // An extended child tool is approved if its parent is approved.
    const parentName = capabilities.toolParentNames?.[toolName];
    return (
      parentName !== undefined &&
      this.catalogManager.isToolApproved(serverName, parentName)
    );
  }

  private permittedCapabilities<T>(
    source: ReadonlyMap<string, ActiveCapability<T>>,
    kind: CapabilityKind,
    consumer: ConsumerContext,
  ): ActiveCapability<T>[] {
    const result: ActiveCapability<T>[] = [];
    for (const cap of source.values()) {
      if (cap.origin === "internal" || this.allows(cap, kind, consumer)) {
        result.push(cap);
      }
    }
    result.sort(
      (a, b) =>
        a.serverName.localeCompare(b.serverName) ||
        a.capabilityName.localeCompare(b.capabilityName),
    );
    return result;
  }

  private allows<T>(
    cap: ActiveCapability<T>,
    kind: CapabilityKind,
    consumer: ConsumerContext,
  ): boolean {
    return this.permissions.hasPermission({
      capabilityKind: kind,
      serviceName: cap.serverName,
      capabilityName: cap.capabilityName,
      clientName: consumer.clientName,
      consumerTag: consumer.consumerTag,
    });
  }

  private notify(kind: CapabilityKind): void {
    safeEmit(
      this.listeners,
      (cb) => cb(kind),
      this.logger,
      "CapabilityResolver listener threw",
      { kind },
    );
  }
}

// Internal prompts (skills as /slash) advertise their bare name — upstream
// prompts are always server-prefixed, so a bare name can't collide. Keeps the
// slash clean (`/greet-user`, not `/mcpx-skills__greet-user`).
function promptProjection(
  def: Prompt,
  serverName: string,
  origin: CapabilityOrigin,
): ProjectedCapability<Prompt> {
  if (origin === "internal") {
    return { key: def.name, capabilityName: def.name, definition: def };
  }
  return prefixedProjection(def, serverName);
}

// Tools/prompts: advertise and key by `server__name`; capabilityName keeps the
// real name so dispatch can address the upstream/internal server.
function prefixedProjection<T extends { name: string }>(
  def: T,
  serverName: string,
): ProjectedCapability<T> {
  const key = `${serverName}${SERVICE_DELIMITER}${def.name}`;
  return { key, capabilityName: def.name, definition: { ...def, name: key } };
}

// Resources: inject the server as the first segment after the uri scheme — the
// disambiguation tools get from the name prefix. capabilityName keeps the real
// (un-injected) uri the read dispatches against; we never reverse-parse the
// advertised form.
function resourceProjection(
  def: Resource,
  serverName: string,
): ProjectedCapability<Resource> {
  const advertisedUri = injectServerIntoUri(def.uri, serverName);
  return {
    key: advertisedUri,
    capabilityName: def.uri,
    definition: { ...def, uri: advertisedUri },
  };
}

function injectServerIntoUri(uri: string, serverName: string): string {
  const sep = uri.indexOf("://");
  if (sep < 0) return `${serverName}/${uri}`;
  const scheme = uri.slice(0, sep);
  const rest = uri.slice(sep + "://".length);
  return `${scheme}://${serverName}/${rest}`;
}

function approvedForServer<T extends { name: string }>(
  source: ReadonlyMap<string, ActiveCapability<T>>,
  serverName: string,
): T[] {
  const result: T[] = [];
  for (const cap of source.values()) {
    if (cap.serverName === serverName) {
      result.push({ ...cap.definition, name: cap.capabilityName });
    }
  }
  return result;
}

// Catalog notifies on every setCatalog and strictness toggle; this filter
// avoids a recompute for pushes that don't change anything we care about.
function catalogChangeAffectsApprovals(change: CatalogChange): boolean {
  return (
    change.strictnessChanged ||
    change.addedServers.length > 0 ||
    change.removedServers.length > 0 ||
    change.approvedToolsChanges.length > 0 ||
    change.approvedPromptsChanges.length > 0
  );
}

function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function activeMapsEqual<T>(
  a: ReadonlyMap<string, ActiveCapability<T>>,
  b: ReadonlyMap<string, ActiveCapability<T>>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [key, av] of a) {
    const bv = b.get(key);
    if (!bv) return false;
    if (av.origin !== bv.origin) return false;
    // Content-aware: catches same-name schema/description/argument changes.
    if (JSON.stringify(av.definition) !== JSON.stringify(bv.definition)) {
      return false;
    }
  }
  return true;
}
