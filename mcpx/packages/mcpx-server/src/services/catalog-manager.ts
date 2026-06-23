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

const DEFAULT_CATALOG_BY_NAME = new Map(
  backendDefaultServers.map((server) => [
    normalizeServerName(server.name),
    { server },
  ]),
);

type SetCatalogPayload = z.infer<typeof McpxBoundPayloads.setCatalog>;

function getApprovedTools(item: CatalogItemWire): string[] | undefined {
  return item.adminConfig?.approvedTools;
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

export interface ApprovedToolsChange {
  serverName: string;
  addedTools: string[];
  removedTools: string[];
}

export interface CatalogChange {
  addedServers: string[];
  removedServers: string[];
  approvedToolsChanges: ApprovedToolsChange[];
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
        approvedTools: getApprovedTools(i),
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
    const approvedTools = getApprovedTools(server);
    if (!approvedTools) {
      return true;
    }
    return approvedTools.includes(toolName);
  }

  // Per-prompt allowlists ride on a wire field that doesn't exist yet
  // (`approvedCapabilities.prompts`); always-approve until the matching
  // webapp-side PR introduces it.
  isPromptApproved(_serviceName: string, _promptName: string): boolean {
    return true;
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

    const approvedToolsChanges: ApprovedToolsChange[] = [];
    for (const item of payload.items) {
      const oldItem = this.catalogByName.get(item.server.name);
      if (!oldItem) continue;
      const oldTools = getApprovedTools(oldItem);
      const newTools = getApprovedTools(item);
      if (this.approvedToolsEqual(oldTools, newTools)) continue;
      const oldSet = new Set(oldTools ?? []);
      const newSet = new Set(newTools ?? []);
      approvedToolsChanges.push({
        serverName: item.server.name,
        addedTools: [...newSet].filter((t) => !oldSet.has(t)).sort(),
        removedTools: [...oldSet].filter((t) => !newSet.has(t)).sort(),
      });
    }

    return {
      addedServers,
      removedServers,
      approvedToolsChanges,
      strictnessChanged: false,
    };
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

function hasProtectableSecretLiteral(
  requirement: EnvRequirement,
): requirement is EnvRequirement & { prefilled: string } {
  return (
    requirement.isSecret &&
    typeof requirement.prefilled === "string" &&
    requirement.prefilled !== ""
  );
}
