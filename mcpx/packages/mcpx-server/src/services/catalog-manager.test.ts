import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { CatalogManager, CatalogChange } from "./catalog-manager.js";
import { CatalogItemWire } from "@mcpx/webapp-protocol/messages";

describe("CatalogManager", () => {
  function createCatalogManager(): CatalogManager {
    return new CatalogManager(noOpLogger);
  }

  function createCatalogItem(
    name: string,
    approvedTools?: string[],
  ): CatalogItemWire {
    return {
      server: {
        name,
        displayName: name,
        config: {
          type: "stdio",
          command: "npx",
          args: ["-y", name],
          env: {},
        },
      },
      adminConfig: approvedTools ? { approvedTools } : undefined,
    };
  }

  describe("#isToolApproved", () => {
    it("returns true for server not in catalog (user-added server)", () => {
      const manager = createCatalogManager();
      manager.setCatalog({ items: [] });

      expect(manager.isToolApproved("unknown-server", "any-tool")).toBe(true);
    });

    it("returns true when no approvedTools configured (no restriction)", () => {
      const manager = createCatalogManager();
      manager.setCatalog({
        items: [createCatalogItem("slack")],
      });

      expect(manager.isToolApproved("slack", "any-tool")).toBe(true);
    });

    it("returns true when approvedTools is empty array (no restriction)", () => {
      const manager = createCatalogManager();
      manager.setCatalog({
        items: [createCatalogItem("slack", [])],
      });

      expect(manager.isToolApproved("slack", "any-tool")).toBe(true);
    });

    it("returns true when tool is in approved list", () => {
      const manager = createCatalogManager();
      manager.setCatalog({
        items: [createCatalogItem("slack", ["send_message", "read_channel"])],
      });

      expect(manager.isToolApproved("slack", "send_message")).toBe(true);
      expect(manager.isToolApproved("slack", "read_channel")).toBe(true);
    });

    it("returns false when tool is not in approved list", () => {
      const manager = createCatalogManager();
      manager.setCatalog({
        items: [createCatalogItem("slack", ["send_message"])],
      });

      expect(manager.isToolApproved("slack", "delete_channel")).toBe(false);
    });

    it("is case-sensitive for tool names", () => {
      const manager = createCatalogManager();
      manager.setCatalog({
        items: [createCatalogItem("slack", ["SendMessage"])],
      });

      expect(manager.isToolApproved("slack", "SendMessage")).toBe(true);
      expect(manager.isToolApproved("slack", "sendmessage")).toBe(false);
    });
  });

  describe("subscribe and change detection", () => {
    it("notifies listener on setCatalog", () => {
      const manager = createCatalogManager();
      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog({ items: [createCatalogItem("slack")] });

      expect(changes).toHaveLength(1);
    });

    it("detects added servers", () => {
      const manager = createCatalogManager();
      manager.setCatalog({ items: [] });

      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog({
        items: [createCatalogItem("slack"), createCatalogItem("github")],
      });

      expect(changes[0]?.addedServers).toContain("slack");
      expect(changes[0]?.addedServers).toContain("github");
      expect(changes[0]?.removedServers).toEqual([]);
    });

    it("detects removed servers", () => {
      const manager = createCatalogManager();
      manager.setCatalog({
        items: [createCatalogItem("slack"), createCatalogItem("github")],
      });

      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog({ items: [createCatalogItem("slack")] });

      expect(changes[0]?.removedServers).toEqual(["github"]);
      expect(changes[0]?.addedServers).toEqual([]);
    });

    it("detects approved tools changes", () => {
      const manager = createCatalogManager();
      manager.setCatalog({
        items: [createCatalogItem("slack", ["tool1"])],
      });

      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog({
        items: [createCatalogItem("slack", ["tool1", "tool2"])],
      });

      expect(changes[0]?.serverApprovedToolsChanged).toEqual(["slack"]);
    });

    it("does not notify when approved tools are same but different order", () => {
      const manager = createCatalogManager();
      manager.setCatalog({
        items: [createCatalogItem("slack", ["tool1", "tool2"])],
      });

      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog({
        items: [createCatalogItem("slack", ["tool2", "tool1"])],
      });

      expect(changes).toHaveLength(0);
    });

    it("does not notify when setCatalog called with identical data", () => {
      const manager = createCatalogManager();
      manager.setCatalog({
        items: [
          createCatalogItem("slack", ["tool1", "tool2"]),
          createCatalogItem("github"),
        ],
      });

      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog({
        items: [
          createCatalogItem("slack", ["tool1", "tool2"]),
          createCatalogItem("github"),
        ],
      });

      expect(changes).toHaveLength(0);
    });

    it("detects change from no restriction to having approved tools", () => {
      const manager = createCatalogManager();
      manager.setCatalog({
        items: [createCatalogItem("slack")],
      });

      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog({
        items: [createCatalogItem("slack", ["tool1"])],
      });

      expect(changes[0]?.serverApprovedToolsChanged).toEqual(["slack"]);
    });

    it("detects change from having approved tools to no restriction", () => {
      const manager = createCatalogManager();
      manager.setCatalog({
        items: [createCatalogItem("slack", ["tool1"])],
      });

      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog({
        items: [createCatalogItem("slack")],
      });

      expect(changes[0]?.serverApprovedToolsChanged).toEqual(["slack"]);
    });

    it("unsubscribe stops notifications", () => {
      const manager = createCatalogManager();
      const changes: CatalogChange[] = [];
      const unsubscribe = manager.subscribe((change) => changes.push(change));

      manager.setCatalog({ items: [createCatalogItem("slack")] });
      expect(changes).toHaveLength(1);

      unsubscribe();
      manager.setCatalog({ items: [createCatalogItem("github")] });
      expect(changes).toHaveLength(1);
    });

    it("does not report new servers as having changed approved tools", () => {
      const manager = createCatalogManager();
      manager.setCatalog({ items: [] });

      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog({
        items: [createCatalogItem("slack", ["tool1"])],
      });

      expect(changes[0]?.addedServers).toEqual(["slack"]);
      expect(changes[0]?.serverApprovedToolsChanged).toEqual([]);
    });
  });

  describe("#getCatalog", () => {
    it("returns catalog items after setCatalog", () => {
      const manager = createCatalogManager();
      manager.setCatalog({
        items: [
          createCatalogItem("slack", ["tool1"]),
          createCatalogItem("github"),
        ],
      });

      const catalog = manager.getCatalog();

      expect(catalog).toHaveLength(2);
      expect(catalog.map((c) => c.server.name).sort()).toEqual([
        "github",
        "slack",
      ]);
    });

    it("returns a clone (not the original)", () => {
      const manager = createCatalogManager();
      manager.setCatalog({ items: [createCatalogItem("slack")] });

      const catalog1 = manager.getCatalog();
      const catalog2 = manager.getCatalog();

      expect(catalog1).not.toBe(catalog2);
      expect(catalog1[0]).not.toBe(catalog2[0]);
    });
  });
});
