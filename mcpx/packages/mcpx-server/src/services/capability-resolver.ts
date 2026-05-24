import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "winston";
import { safeEmit } from "./capability-notifications.js";
import {
  CapabilityKind,
  CapabilityOrigin,
  CapabilityRegistry,
  ServerCapabilities,
} from "./capability-registry.js";
import { CatalogChange, CatalogManagerI } from "./catalog-manager.js";
import { SERVICE_DELIMITER } from "./oauth-tools.js";

export interface ActiveCapability<Definition> {
  readonly serverName: string;
  readonly capabilityName: string;
  readonly definition: Definition;
  // Inherited from the registering server, so the gateway can dispatch
  // per-capability (internal → InternalToolsService, upstream → proxy).
  readonly origin: CapabilityOrigin;
}

export type ActiveTool = ActiveCapability<Tool>;

export interface ConsumerContext {
  consumerTag?: string;
  clientName?: string;
}

// Minimal slice of PermissionManager so tests can stub trivially.
export interface PermissionCheck {
  hasPermission(props: {
    serviceName: string;
    toolName: string;
    clientName?: string;
    consumerTag?: string;
  }): boolean;
}

export type UnavailableReason =
  | "unknown"
  | "server-inactive"
  | "permission-denied";

export type ResolvedToolCall =
  | { ok: true; entry: ActiveTool }
  | { ok: false; reason: UnavailableReason };

type ChangeListener = (kind: CapabilityKind) => void | Promise<void>;
type Unsubscribe = () => void;

// Active capability set per kind = registry ∩ admin-active ∩ catalog approvals.
// Per-consumer permissions are layered on top via visibleCapabilities / allows.
// Today only "tools" carries entries; "resources" and "prompts" reserve their
// slot so adding wiring later (recompute branch, public getter, gateway list
// handler) is a localized change, not a structural refactor.
export class CapabilityResolver {
  private _activeByKind: Record<
    CapabilityKind,
    Map<string, ActiveCapability<unknown>>
  > = {
    tools: new Map(),
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
    return this._activeByKind.tools as ReadonlyMap<string, ActiveTool>;
  }

  setInactiveServers(names: ReadonlySet<string>): void {
    if (setsEqual(this.inactiveNames, names)) return;
    this.inactiveNames.clear();
    for (const n of names) this.inactiveNames.add(n);
    this.recompute();
  }

  // Unprefixed tools for a single server. Safe to call immediately after
  // registry.registerServer() because the registry's notify → recompute chain
  // runs synchronously.
  getApprovedToolsForServer(serverName: string): Tool[] {
    const result: Tool[] = [];
    for (const cap of this.activeTools.values()) {
      if (cap.serverName === serverName) {
        result.push({ ...cap.definition, name: cap.capabilityName });
      }
    }
    return result;
  }

  getVisibleTools(consumer: ConsumerContext): ActiveTool[] {
    return this.visibleCapabilities(this.activeTools, consumer);
  }

  // Resolves a prefixed tool name to its ActiveTool entry or the reason it's
  // unavailable.
  resolveToolCall(name: string, consumer: ConsumerContext): ResolvedToolCall {
    const entry = this.activeTools.get(name);
    if (!entry) {
      // Distinguish "admin marked inactive" from "never existed".
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
    if (entry.origin !== "internal" && !this.allows(entry, consumer)) {
      return { ok: false, reason: "permission-denied" };
    }
    return { ok: true, entry };
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
    const nextTools = new Map<string, ActiveTool>();

    for (const [serverName, capabilities] of this.registry.servers) {
      if (this.inactiveNames.has(serverName)) continue;
      for (const { definition, origin } of capabilities.tools ?? []) {
        // Internal tools are mcpx-synthesized and bypass catalog approval —
        // they aren't catalog items.
        if (
          origin === "upstream" &&
          !this.isToolApproved(serverName, definition.name, capabilities)
        ) {
          continue;
        }
        const prefixedName = `${serverName}${SERVICE_DELIMITER}${definition.name}`;
        nextTools.set(prefixedName, {
          serverName,
          capabilityName: definition.name,
          definition: { ...definition, name: prefixedName },
          origin,
        });
      }
    }

    this._activeByKind.tools = nextTools;
    this.notify("tools");
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

  private visibleCapabilities<T>(
    source: ReadonlyMap<string, ActiveCapability<T>>,
    consumer: ConsumerContext,
  ): ActiveCapability<T>[] {
    const result: ActiveCapability<T>[] = [];
    for (const cap of source.values()) {
      if (cap.origin === "internal" || this.allows(cap, consumer)) {
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
    consumer: ConsumerContext,
  ): boolean {
    return this.permissions.hasPermission({
      serviceName: cap.serverName,
      toolName: cap.capabilityName,
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

// Catalog notifies on every setCatalog and strictness toggle; this filter
// avoids a recompute for pushes that don't change anything we care about.
function catalogChangeAffectsApprovals(change: CatalogChange): boolean {
  return (
    change.strictnessChanged ||
    change.addedServers.length > 0 ||
    change.removedServers.length > 0 ||
    change.serverApprovedToolsChanged.length > 0
  );
}

function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}
