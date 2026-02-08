import { Logger } from "winston";
import { backendDefaultServers } from "../server/constants-servers.js";
import z from "zod/v4";
import {
  McpxBoundPayloads,
  CatalogItemWire,
} from "@mcpx/webapp-protocol/messages";
import { normalizeServerName } from "@mcpx/toolkit-core/data";
import { IdentityServiceI } from "./identity-service.js";

const DEFAULT_CATALOG_BY_NAME = new Map(
  backendDefaultServers.map((server) => [
    normalizeServerName(server.name),
    { server },
  ]),
);

type SetCatalogPayload = z.infer<typeof McpxBoundPayloads.setCatalog>;

export interface CatalogChange {
  addedServers: string[];
  removedServers: string[];
  serverApprovedToolsChanged: string[];
  strictnessChanged: boolean;
}

export interface CatalogManagerI {
  setCatalog(payload: SetCatalogPayload): void;
  getCatalog(): CatalogItemWire[];
  isStrict(): boolean;
  setAdminStrictnessOverride(override: boolean): void;
  getAdminStrictnessOverride(): boolean;
  getById(id: string): CatalogItemWire | undefined;
  isServerApproved(serviceName: string): boolean;
  isToolApproved(serviceName: string, toolName: string): boolean;
  subscribe(callback: (change: CatalogChange) => void): () => void;
}

// CatalogManager interprets identity to derive strictness.
// Personal mode: not strict. Enterprise space: not strict. Enterprise user: strict.
// Admin can set override to bypass strictness for debugging.
export class CatalogManager implements CatalogManagerI {
  private catalogByName: Map<string, CatalogItemWire>;
  private logger: Logger;
  private listeners = new Set<(change: CatalogChange) => void>();
  private identityService: IdentityServiceI;
  private adminStrictnessOverride = false;
  public readonly isStrictnessRequired;

  constructor(
    logger: Logger,
    identityService: IdentityServiceI,
    isStrictnessRequired: boolean,
  ) {
    this.logger = logger.child({ component: "CatalogManager" });
    this.identityService = identityService;
    // In enterprise mode, catalog starts empty (Hub controls it)
    // In personal mode, use fallback defaults
    const isEnterprise = identityService.getIdentity().mode === "enterprise";
    this.catalogByName = isEnterprise ? new Map() : DEFAULT_CATALOG_BY_NAME;
    this.isStrictnessRequired = isStrictnessRequired;
    this.adminStrictnessOverride = !isStrictnessRequired; // admin strictness default match the system strictness
  }

  subscribe(callback: (change: CatalogChange) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(change: CatalogChange): void {
    this.listeners.forEach((cb) => cb(change));
  }

  getCatalog(): CatalogItemWire[] {
    return structuredClone(Array.from(this.catalogByName.values()));
  }

  isStrict(): boolean {
    if (!this.isStrictnessRequired) {
      this.logger.debug(
        "Strictness derive from system strictness not enabled: ",
        {
          isStrict: false,
        },
      );
      // no strictness required in the system, no need to check further.
      return false;
    }
    if (this.adminStrictnessOverride) {
      this.logger.debug("Strictness derive from admin override: ", {
        isStrict: false,
      });
      return false;
    }
    const strictness = this.deriveStrictnessFromIdentity();
    this.logger.debug("Strictness derive from identity: ", {
      isStrict: strictness,
    });

    return strictness;
  }

  // TODO(MCP-691): Catalog is keyed by name but should be keyed by ID.
  // This is a linear scan - refactor to use catalogById map when ready.
  getById(id: string): CatalogItemWire | undefined {
    for (const item of this.catalogByName.values()) {
      if (item.server.id === id) {
        return structuredClone(item);
      }
    }
    return undefined;
  }

  private deriveStrictnessFromIdentity(): boolean {
    const identity = this.identityService.getIdentity();
    if (identity.mode === "personal") {
      this.logger.debug(
        "personal mode. Strictness will be derive from identity: ",
        {
          identity: identity.mode,
        },
      );
      return false;
    }
    this.logger.debug(
      "Enterprise mode. Strictness will be derive from identity: ",
      {
        identity: identity.entity.entityType,
      },
    );
    return identity.entity.entityType === "user"; // space is not strict, but actual users are strict
  }

  setAdminStrictnessOverride(override: boolean): void {
    this.adminStrictnessOverride = override;
    this.logger.info("Admin strictness override set", {
      override,
      effectiveStrict: this.isStrict(),
    });
    this.notifyListeners({
      addedServers: [],
      removedServers: [],
      serverApprovedToolsChanged: [],
      strictnessChanged: true,
    });
  }

  getAdminStrictnessOverride(): boolean {
    return this.adminStrictnessOverride;
  }

  setCatalog(payload: SetCatalogPayload): void {
    const normalizedPayload = {
      ...payload,
      items: payload.items.map((item) => ({
        ...item,
        server: {
          ...item.server,
          name: normalizeServerName(item.server.name),
        },
      })),
    };
    this.logger.info("Loading servers catalog from Hub", {
      serverCount: normalizedPayload.items.length,
      serverNames: normalizedPayload.items.map((i) => ({
        name: i.server.name,
        approvedTools: i.adminConfig?.approvedTools,
      })),
    });

    const change = this.computeChange(normalizedPayload);
    this.catalogByName = new Map(
      normalizedPayload.items.map((item) => [item.server.name, item]),
    );

    this.notifyListeners(change);
  }

  isServerApproved(serviceName: string): boolean {
    if (!this.isStrict()) {
      return true;
    }
    return this.catalogByName.has(normalizeServerName(serviceName));
  }

  isToolApproved(serviceName: string, toolName: string): boolean {
    if (!this.isStrict()) {
      return true;
    }
    const server = this.catalogByName.get(normalizeServerName(serviceName));
    if (!server) {
      return false;
    }
    const approvedTools = server.adminConfig?.approvedTools;
    if (!approvedTools) {
      return true;
    }
    return approvedTools.includes(toolName);
  }

  private computeChange(payload: SetCatalogPayload): CatalogChange {
    const oldNames = new Set(this.catalogByName.keys());
    const newNames = new Set(payload.items.map((i) => i.server.name));

    const addedServers = payload.items
      .filter((item) => !oldNames.has(item.server.name))
      .map((item) => item.server.name);

    const removedServers = Array.from(oldNames).filter(
      (name) => !newNames.has(name),
    );

    const serverApprovedToolsChanged = payload.items
      .filter((item) => {
        const oldItem = this.catalogByName.get(item.server.name);
        if (!oldItem) return false;
        return !this.approvedToolsEqual(
          oldItem.adminConfig?.approvedTools,
          item.adminConfig?.approvedTools,
        );
      })
      .map((item) => item.server.name);

    return {
      addedServers,
      removedServers,
      serverApprovedToolsChanged,
      strictnessChanged: false,
    };
  }

  private approvedToolsEqual(
    a: string[] | undefined,
    b: string[] | undefined,
  ): boolean {
    if (a === undefined && b === undefined) return true;
    if (a === undefined || b === undefined) return false;
    const setA = new Set(a);
    const setB = new Set(b);
    if (setA.size !== setB.size) return false;
    return Array.from(setA).every((val) => setB.has(val));
  }
}
