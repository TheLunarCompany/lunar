import { Logger } from "winston";
import { backendDefaultServers } from "../server/constants-servers.js";
import z from "zod/v4";
import {
  McpxBoundPayloads,
  CatalogItemWire,
} from "@mcpx/webapp-protocol/messages";

type SetCatalogPayload = z.infer<typeof McpxBoundPayloads.setCatalog>;

export interface CatalogChange {
  addedServers: string[];
  removedServers: string[];
  serverApprovedToolsChanged: string[];
}

export interface CatalogManagerI {
  setCatalog(payload: SetCatalogPayload): void;
  getCatalog(): CatalogItemWire[];
  isToolApproved(serviceName: string, toolName: string): boolean;
  subscribe(callback: (change: CatalogChange) => void): () => void;
}

export class CatalogManager implements CatalogManagerI {
  private catalogByName: Map<string, CatalogItemWire>;
  private logger: Logger;
  private listeners = new Set<(change: CatalogChange) => void>();

  constructor(logger: Logger) {
    this.logger = logger.child({ component: "CatalogManager" });
    // Initialize from default servers (no restrictions for defaults)
    this.catalogByName = new Map(
      backendDefaultServers.map((server) => [server.name, { server }]),
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

  setCatalog(payload: SetCatalogPayload): void {
    this.logger.info("Loading servers catalog from Hub", {
      serverCount: payload.items.length,
      serverNames: payload.items.map((i) => i.server.name),
      serversWithApprovedTools: payload.items
        .filter((i) => i.adminConfig?.approvedTools?.length)
        .map((i) => i.server.name),
    });

    const change = this.computeChange(payload);
    this.catalogByName = new Map(
      payload.items.map((item) => [item.server.name, item]),
    );

    if (this.hasChange(change)) {
      this.notifyListeners(change);
    }
  }

  private hasChange(change: CatalogChange): boolean {
    return (
      change.addedServers.length > 0 ||
      change.removedServers.length > 0 ||
      change.serverApprovedToolsChanged.length > 0
    );
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
    const setA = new Set(a ?? []);
    const setB = new Set(b ?? []);
    if (setA.size !== setB.size) return false;
    return Array.from(setA).every((val) => setB.has(val));
  }

  /**
   * Check if a tool is approved for use.
   * Returns true if the server has no restriction or the tool is in the approved list.
   */
  isToolApproved(serviceName: string, toolName: string): boolean {
    const item = this.catalogByName.get(serviceName);
    if (!item) {
      // Server not in catalog - allow (might be user-added server)
      return true;
    }
    const approvedTools = item.adminConfig?.approvedTools;
    if (!approvedTools || approvedTools.length === 0) {
      // No restriction configured
      return true;
    }
    return approvedTools.includes(toolName);
  }
}
