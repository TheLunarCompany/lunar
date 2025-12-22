import { CatalogMCPServerList } from "@mcpx/shared-model";
import { Logger } from "winston";
import { backendDefaultServers } from "../server/constants-servers.js";
import z from "zod/v4";
import { McpxBoundPayloads } from "@mcpx/webapp-protocol/messages";

type SetCatalogPayload = z.infer<typeof McpxBoundPayloads.setCatalog>;

export interface CatalogManagerI {
  setCatalog(payload: SetCatalogPayload): void;
  getCatalog(): CatalogMCPServerList;
}

export class CatalogManager implements CatalogManagerI {
  private catalog: CatalogMCPServerList;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: "CatalogManager" });
    // initialize the catalog from the default servers
    this.catalog = backendDefaultServers;
  }

  getCatalog(): CatalogMCPServerList {
    return structuredClone(this.catalog);
  }

  setCatalog(payload: SetCatalogPayload): void {
    // parse and error handel done in the hub
    this.logger.info("Loading servers catalog from Hub", {
      serverCount: payload.servers.length,
      serverNames: payload.servers.map((s) => s.name),
    });
    this.catalog = payload.servers;
  }
}
