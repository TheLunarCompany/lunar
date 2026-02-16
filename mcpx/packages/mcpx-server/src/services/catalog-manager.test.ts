import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { CatalogManager, CatalogChange } from "./catalog-manager.js";
import { CatalogItemWire } from "@mcpx/webapp-protocol/messages";
import {
  IdentityServiceI,
  Identity,
  isSpace,
  isAdmin,
} from "./identity-service.js";
import { v7 as uuidv7 } from "uuid";

function createStubIdentityService(identity: Identity): IdentityServiceI {
  return {
    getIdentity: () => identity,
    setIdentity: () => {},
    isSpace: () => isSpace(identity),
    isAdmin: () => isAdmin(identity),
  };
}

const personalIdentity: Identity = { mode: "personal" };
const enterpriseUserIdentity: Identity = {
  mode: "enterprise",
  entity: { entityType: "user", role: "member" },
};
const enterpriseSpaceIdentity: Identity = {
  mode: "enterprise",
  entity: { entityType: "space" },
};

describe("CatalogManager", () => {
  function createCatalogManager(
    identityService: IdentityServiceI = createStubIdentityService(
      enterpriseUserIdentity,
    ),
    isStrictnessRequired = true,
  ): CatalogManager {
    return new CatalogManager(
      noOpLogger,
      identityService,
      isStrictnessRequired,
    );
  }

  function createCatalogItem(
    name: string,
    approvedTools?: string[],
  ): CatalogItemWire {
    return {
      server: {
        id: uuidv7(),
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

  function makeCatalog(...items: CatalogItemWire[]) {
    return { items };
  }

  describe("strictness based on identity", () => {
    describe("personal mode (not strict)", () => {
      it("approves all servers", () => {
        const manager = createCatalogManager(
          createStubIdentityService(personalIdentity),
        );
        expect(manager.isServerApproved("any-server")).toBe(true);
      });

      it("approves all tools", () => {
        const manager = createCatalogManager(
          createStubIdentityService(personalIdentity),
        );
        expect(manager.isToolApproved("any-server", "any-tool")).toBe(true);
      });
    });

    describe("enterprise user mode (strict)", () => {
      it("rejects servers not in catalog before setCatalog", () => {
        const manager = createCatalogManager(
          createStubIdentityService(enterpriseUserIdentity),
        );
        expect(manager.isServerApproved("unknown-server")).toBe(false);
      });

      it("accepts servers after setCatalog adds them", () => {
        const manager = createCatalogManager(
          createStubIdentityService(enterpriseUserIdentity),
        );
        manager.setCatalog(makeCatalog(createCatalogItem("slack")));
        expect(manager.isServerApproved("slack")).toBe(true);
      });

      it("rejects servers not in catalog", () => {
        const manager = createCatalogManager(
          createStubIdentityService(enterpriseUserIdentity),
        );
        manager.setCatalog(makeCatalog(createCatalogItem("slack")));
        expect(manager.isServerApproved("unknown")).toBe(false);
      });
    });

    describe("enterprise space mode (not strict)", () => {
      it("approves all servers", () => {
        const manager = createCatalogManager(
          createStubIdentityService(enterpriseSpaceIdentity),
        );
        manager.setCatalog(makeCatalog(createCatalogItem("slack")));
        expect(manager.isServerApproved("any-server")).toBe(true);
      });

      it("approves all tools", () => {
        const manager = createCatalogManager(
          createStubIdentityService(enterpriseSpaceIdentity),
        );
        manager.setCatalog(makeCatalog(createCatalogItem("slack", [])));
        expect(manager.isToolApproved("slack", "any-tool")).toBe(true);
      });
    });
  });

  describe("enterprise mode - when strictness are disabled ", () => {
    it("should not be strict for enterprise users when strictness disabled", () => {
      const manager = createCatalogManager(
        createStubIdentityService(enterpriseUserIdentity),
        false,
      );
      expect(manager.isStrict()).toBe(false);
    });

    it("should approve all servers when strictness disabled", () => {
      const manager = createCatalogManager(
        createStubIdentityService(enterpriseUserIdentity),
        false,
      );
      manager.setCatalog(makeCatalog(createCatalogItem("slack")));
      expect(manager.isServerApproved("any-server")).toBe(true);
    });

    it("should approve all tools when strictness disabled", () => {
      const manager = createCatalogManager(
        createStubIdentityService(enterpriseUserIdentity),
        false,
      );
      manager.setCatalog(makeCatalog(createCatalogItem("slack", [])));
      expect(manager.isToolApproved("slack", "any-tool")).toBe(true);
    });
  });

  describe("#isToolApproved", () => {
    it("returns false for server not in catalog (user-added server)", () => {
      const manager = createCatalogManager();
      manager.setCatalog(makeCatalog());

      expect(manager.isToolApproved("unknown-server", "any-tool")).toBe(false);
    });

    it("returns true when no approvedTools configured (no restriction)", () => {
      const manager = createCatalogManager();
      manager.setCatalog(makeCatalog(createCatalogItem("slack")));

      expect(manager.isToolApproved("slack", "any-tool")).toBe(true);
    });

    it("returns false when approvedTools is empty array", () => {
      const manager = createCatalogManager();
      manager.setCatalog(makeCatalog(createCatalogItem("slack", [])));

      expect(manager.isToolApproved("slack", "any-tool")).toBe(false);
    });

    it("returns true when tool is in approved list", () => {
      const manager = createCatalogManager();
      manager.setCatalog(
        makeCatalog(
          createCatalogItem("slack", ["send_message", "read_channel"]),
        ),
      );

      expect(manager.isToolApproved("slack", "send_message")).toBe(true);
      expect(manager.isToolApproved("slack", "read_channel")).toBe(true);
    });

    it("returns false when tool is not in approved list", () => {
      const manager = createCatalogManager();
      manager.setCatalog(
        makeCatalog(createCatalogItem("slack", ["send_message"])),
      );

      expect(manager.isToolApproved("slack", "delete_channel")).toBe(false);
    });

    it("is case-sensitive for tool names", () => {
      const manager = createCatalogManager();
      manager.setCatalog(
        makeCatalog(createCatalogItem("slack", ["SendMessage"])),
      );

      expect(manager.isToolApproved("slack", "SendMessage")).toBe(true);
      expect(manager.isToolApproved("slack", "sendmessage")).toBe(false);
    });
  });

  describe("subscribe and change detection", () => {
    it("notifies listener on setCatalog", () => {
      const manager = createCatalogManager();
      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog(makeCatalog(createCatalogItem("slack")));

      expect(changes).toHaveLength(1);
    });

    it("detects added servers", () => {
      const manager = createCatalogManager();
      manager.setCatalog(makeCatalog());

      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog(
        makeCatalog(createCatalogItem("slack"), createCatalogItem("github")),
      );

      expect(changes[0]?.addedServers).toContain("slack");
      expect(changes[0]?.addedServers).toContain("github");
      expect(changes[0]?.removedServers).toEqual([]);
    });

    it("detects removed servers", () => {
      const manager = createCatalogManager();
      manager.setCatalog(
        makeCatalog(createCatalogItem("slack"), createCatalogItem("github")),
      );

      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog(makeCatalog(createCatalogItem("slack")));

      expect(changes[0]?.removedServers).toEqual(["github"]);
      expect(changes[0]?.addedServers).toEqual([]);
    });

    it("detects approved tools changes", () => {
      const manager = createCatalogManager();
      manager.setCatalog(makeCatalog(createCatalogItem("slack", ["tool1"])));

      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog(
        makeCatalog(createCatalogItem("slack", ["tool1", "tool2"])),
      );

      expect(changes[0]?.serverApprovedToolsChanged).toEqual(["slack"]);
    });

    it("notifies with empty change when approved tools are same but different order", () => {
      const manager = createCatalogManager();
      manager.setCatalog(
        makeCatalog(createCatalogItem("slack", ["tool1", "tool2"])),
      );

      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog(
        makeCatalog(createCatalogItem("slack", ["tool2", "tool1"])),
      );

      expect(changes).toHaveLength(1);
      expect(changes[0]?.serverApprovedToolsChanged).toEqual([]);
    });

    it("notifies with empty change when setCatalog called with identical data", () => {
      const manager = createCatalogManager();
      manager.setCatalog(
        makeCatalog(
          createCatalogItem("slack", ["tool1", "tool2"]),
          createCatalogItem("github"),
        ),
      );

      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog(
        makeCatalog(
          createCatalogItem("slack", ["tool1", "tool2"]),
          createCatalogItem("github"),
        ),
      );
      expect(changes).toHaveLength(1);
      expect(changes[0]?.addedServers).toEqual([]);
      expect(changes[0]?.removedServers).toEqual([]);
      expect(changes[0]?.serverApprovedToolsChanged).toEqual([]);
    });

    it("detects change from no restriction to having approved tools", () => {
      const manager = createCatalogManager();
      manager.setCatalog(makeCatalog(createCatalogItem("slack")));

      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog(makeCatalog(createCatalogItem("slack", ["tool1"])));

      expect(changes[0]?.serverApprovedToolsChanged).toEqual(["slack"]);
    });

    it("detects change from having approved tools to no restriction", () => {
      const manager = createCatalogManager();
      manager.setCatalog(makeCatalog(createCatalogItem("slack", ["tool1"])));

      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog(makeCatalog(createCatalogItem("slack")));

      expect(changes[0]?.serverApprovedToolsChanged).toEqual(["slack"]);
    });

    it("unsubscribe stops notifications", () => {
      const manager = createCatalogManager();
      const changes: CatalogChange[] = [];
      const unsubscribe = manager.subscribe((change) => changes.push(change));

      manager.setCatalog(makeCatalog(createCatalogItem("slack")));
      expect(changes).toHaveLength(1);

      unsubscribe();
      manager.setCatalog(makeCatalog(createCatalogItem("github")));
      expect(changes).toHaveLength(1);
    });

    it("does not report new servers as having changed approved tools", () => {
      const manager = createCatalogManager();
      manager.setCatalog(makeCatalog());

      const changes: CatalogChange[] = [];
      manager.subscribe((change) => changes.push(change));

      manager.setCatalog(makeCatalog(createCatalogItem("slack", ["tool1"])));

      expect(changes[0]?.addedServers).toEqual(["slack"]);
      expect(changes[0]?.serverApprovedToolsChanged).toEqual([]);
    });
  });

  describe("#getCatalog", () => {
    it("returns catalog items after setCatalog", () => {
      const manager = createCatalogManager();
      manager.setCatalog(
        makeCatalog(
          createCatalogItem("slack", ["tool1"]),
          createCatalogItem("github"),
        ),
      );

      const catalog = manager.getCatalog();

      expect(catalog).toHaveLength(2);
      expect(catalog.map((c) => c.server.name).sort()).toEqual([
        "github",
        "slack",
      ]);
    });

    it("returns a clone (not the original)", () => {
      const manager = createCatalogManager();
      manager.setCatalog(makeCatalog(createCatalogItem("slack")));

      const catalog1 = manager.getCatalog();
      const catalog2 = manager.getCatalog();

      expect(catalog1).not.toBe(catalog2);
      expect(catalog1[0]).not.toBe(catalog2[0]);
    });
  });
});
