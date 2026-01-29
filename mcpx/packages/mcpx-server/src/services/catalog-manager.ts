import { Logger } from "winston";
import { backendDefaultServers } from "../server/constants-servers.js";
import z from "zod/v4";
import {
  McpxBoundPayloads,
  CatalogItemWire,
} from "@mcpx/webapp-protocol/messages";
import { normalizeServerName } from "@mcpx/toolkit-core/data";

type SetCatalogPayload = z.infer<typeof McpxBoundPayloads.setCatalog>;

export interface CatalogChange {
  addedServers: string[];
  removedServers: string[];
  serverApprovedToolsChanged: string[];
}

export interface CatalogManagerI {
  setCatalog(payload: SetCatalogPayload): void;
  getCatalog(): CatalogItemWire[];
  getById(id: string): CatalogItemWire | undefined;
  // TODO(MCP-701): Temporary hack - remove when admin-awareness is properly implemented
  getIsStrict(): boolean;
  isServerApproved(serviceName: string): boolean;
  isToolApproved(serviceName: string, toolName: string): boolean;
  subscribe(callback: (change: CatalogChange) => void): () => void;
}

// In enterprise mode, isStrict defaults to true (Hub controls catalog).
// In non-enterprise mode, isStrict is false (permissive, no Hub).
export class CatalogManager implements CatalogManagerI {
  private catalogByName: Map<string, CatalogItemWire>;
  private logger: Logger;
  private listeners = new Set<(change: CatalogChange) => void>();
  private isStrict: boolean;

  constructor(logger: Logger, config: { isEnterprise: boolean }) {
    this.logger = logger.child({ component: "CatalogManager" });
    this.isStrict = config.isEnterprise;
    // In enterprise mode, catalog starts empty (Hub controls it)
    // In non-enterprise mode, use fallback defaults
    this.catalogByName = config.isEnterprise
      ? new Map()
      : new Map(
          backendDefaultServers.map((server) => [
            normalizeServerName(server.name),
            { server },
          ]),
        );
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

  // TODO(MCP-701): Temporary hack - remove when admin-awareness is properly implemented
  getIsStrict(): boolean {
    return this.isStrict;
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
    this.isStrict = payload.isStrict;
    this.logger.info("Loading servers catalog from Hub", {
      isStrict: this.isStrict,
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

  /**
   * Check if a server is approved (exists in catalog).
   * When catalog is not strict, all servers are approved.
   */
  isServerApproved(serviceName: string): boolean {
    if (!this.isStrict) {
      return true;
    }
    return this.catalogByName.has(normalizeServerName(serviceName));
  }

  /**
   * Check if a tool is approved for use.
   * When catalog is not strict, all tools are approved.
   * Otherwise, returns true if the server has no restriction or the tool is in the approved list.
   */
  isToolApproved(serviceName: string, toolName: string): boolean {
    if (!this.isStrict) {
      return true;
    }
    const server = this.catalogByName.get(normalizeServerName(serviceName));
    if (!server) {
      return false;
    }
    const approvedTools = server.adminConfig?.approvedTools;
    if (!approvedTools) {
      // No restriction configured
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

    return { addedServers, removedServers, serverApprovedToolsChanged };
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
