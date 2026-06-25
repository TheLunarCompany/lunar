import { Logger } from "winston";
import { backendDefaultServers } from "../server/constants-servers.js";
import z from "zod/v4";
import {
  McpxBoundPayloads,
  CatalogItemWire,
} from "@mcpx/webapp-protocol/messages";
import { normalizeServerName } from "@mcpx/toolkit-core/data";
import { EnvRequirement } from "@mcpx/shared-model";
import { EnvVarManager } from "./env-var-manager.js";
import { IdentityServiceI } from "./identity-service.js";
import { CapabilityKind } from "./capability-registry.js";

const DEFAULT_CATALOG_BY_NAME = new Map(
  backendDefaultServers.map((server) => [
    normalizeServerName(server.name),
    { server },
  ]),
);

type SetCatalogPayload = z.infer<typeof McpxBoundPayloads.setCatalog>;

// Single accessor for both capability kinds: tools and prompts are stored
// symmetrically on adminConfig, so one kind-parameterized getter avoids the
// parallel tool/prompt code paths that previously drifted out of sync.
function getApprovedNames(
  item: CatalogItemWire,
  kind: CapabilityKind,
): string[] | undefined {
  return kind === "tools"
    ? item.adminConfig?.approvedTools
    : item.adminConfig?.approvedPrompts;
}

// See unit tests for normalization logic (with edge cases)
export function toProcessEnvKey(
  serverName: string,
  envVarName: string,
): string {
  return `MCPX_${serverName}_${envVarName}_PREFILLED`
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_{2,}/g, "_");
}

// One change shape for both kinds. The owning array (approvedToolsChanges /
// approvedPromptsChanges) identifies the capability kind, so the element stays
// kind-agnostic instead of repeating added/removed under kind-suffixed names.
export interface ApprovedNamesChange {
  serverName: string;
  added: string[];
  removed: string[];
}

export interface CatalogChange {
  addedServers: string[];
  removedServers: string[];
  approvedToolsChanges: ApprovedNamesChange[];
  approvedPromptsChanges: ApprovedNamesChange[];
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
  isPromptApproved(serviceName: string, promptName: string): boolean;
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
    private envVarManager: EnvVarManager,
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
      // no strictness required in the system, no need to check further.
      return false;
    }
    if (this.adminStrictnessOverride) {
      return false;
    }
    return this.deriveStrictnessFromIdentity();
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
      return false;
    }
    // space is not strict, but actual users are strict
    return identity.entity.entityType === "user";
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
      approvedToolsChanges: [],
      approvedPromptsChanges: [],
      strictnessChanged: true,
    });
  }

  getAdminStrictnessOverride(): boolean {
    return this.adminStrictnessOverride;
  }

  setCatalog(payload: SetCatalogPayload): void {
    const normalizedItems = payload.items.map((item) => ({
      ...item,
      server: {
        ...item.server,
        name: normalizeServerName(item.server.name),
      },
    }));
    const protectionResults = normalizedItems.map((item) =>
      this.protectSecretPrefilledLiterals(item),
    );
    const literals = Object.fromEntries(
      protectionResults.flatMap((r) => Object.entries(r.literals)),
    );
    this.envVarManager.setSecretPrefilledLiterals(literals);
    const normalizedPayload = {
      ...payload,
      items: protectionResults.map((r) => r.item),
    };

    this.logger.info("Loading servers catalog from Hub", {
      serverCount: normalizedPayload.items.length,
      serverNames: normalizedPayload.items.map((i) => ({
        name: i.server.name,
        approvedTools: getApprovedNames(i, "tools"),
        approvedPrompts: getApprovedNames(i, "prompts"),
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
    return this.isCapabilityApproved("tools", serviceName, toolName);
  }

  isPromptApproved(serviceName: string, promptName: string): boolean {
    return this.isCapabilityApproved("prompts", serviceName, promptName);
  }

  // Single approval rule for both kinds: non-strict contexts approve everything,
  // an unknown server is denied, a server with no allowlist approves everything,
  // otherwise the name must be on the allowlist. Tools and prompts share this so
  // they cannot diverge (previously prompts skipped the strictness short-circuit).
  private isCapabilityApproved(
    kind: CapabilityKind,
    serviceName: string,
    capabilityName: string,
  ): boolean {
    if (!this.isStrict()) {
      return true;
    }
    const server = this.catalogByName.get(normalizeServerName(serviceName));
    if (!server) {
      return false;
    }
    const approvedNames = getApprovedNames(server, kind);
    if (!approvedNames) {
      return true;
    }
    return approvedNames.includes(capabilityName);
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

    return {
      addedServers,
      removedServers,
      approvedToolsChanges: this.computeApprovedChanges(payload, "tools"),
      approvedPromptsChanges: this.computeApprovedChanges(payload, "prompts"),
      strictnessChanged: false,
    };
  }

  // Diff the approved-name allowlist for one capability kind across the catalog.
  // Runs once per kind so a prompt-only edit produces a change record exactly
  // like a tool edit (previously only tools were diffed, so prompt approval
  // edits silently never triggered a resolver recompute).
  private computeApprovedChanges(
    payload: SetCatalogPayload,
    kind: CapabilityKind,
  ): ApprovedNamesChange[] {
    const changes: ApprovedNamesChange[] = [];
    for (const item of payload.items) {
      const oldItem = this.catalogByName.get(item.server.name);
      if (!oldItem) continue;
      const oldNames = getApprovedNames(oldItem, kind);
      const newNames = getApprovedNames(item, kind);
      if (this.approvedNamesEqual(oldNames, newNames)) continue;
      const oldSet = new Set(oldNames ?? []);
      const newSet = new Set(newNames ?? []);
      changes.push({
        serverName: item.server.name,
        added: [...newSet].filter((n) => !oldSet.has(n)).sort(),
        removed: [...oldSet].filter((n) => !newSet.has(n)).sort(),
      });
    }
    return changes;
  }

  private protectSecretPrefilledLiterals(item: CatalogItemWire): {
    item: CatalogItemWire;
    literals: Record<string, string>;
  } {
    const { config } = item.server;
    if (config.type !== "stdio" || !config.env) {
      return { item, literals: {} };
    }

    const classified = Object.entries(config.env).map(
      ([envVarName, requirement]) => {
        if (!hasProtectableSecretLiteral(requirement)) {
          return {
            protectedEntry: [envVarName, requirement],
            literal: null,
          };
        }
        const processEnvKey = toProcessEnvKey(item.server.name, envVarName);
        return {
          protectedEntry: [
            envVarName,
            { ...requirement, prefilled: { fromEnv: processEnvKey } },
          ],
          literal: [processEnvKey, requirement.prefilled],
        };
      },
    );

    const protectedEnv = Object.fromEntries(
      classified.map((c) => c.protectedEntry),
    );
    const literals = Object.fromEntries(
      classified.flatMap((c) => (c.literal ? [c.literal] : [])),
    );

    return {
      item: {
        ...item,
        server: { ...item.server, config: { ...config, env: protectedEnv } },
      },
      literals,
    };
  }

  private approvedNamesEqual(
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

function hasProtectableSecretLiteral(
  requirement: EnvRequirement,
): requirement is EnvRequirement & { prefilled: string } {
  return (
    requirement.isSecret &&
    typeof requirement.prefilled === "string" &&
    requirement.prefilled !== ""
  );
}
