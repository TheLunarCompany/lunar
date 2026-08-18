import { Config } from "../src/model/config/config.js";
import { getTestHarness } from "./utils.js";

const CONFIG_BASE = "http://localhost:9000/config";

const post = (url: string, body: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const put = (url: string, body: unknown) =>
  fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const del = (url: string) => fetch(url, { method: "DELETE" });

describe("Control Plane App Config", () => {
  const harness = getTestHarness({ targetServers: [] });
  let initialConfig: Config;

  beforeAll(async () => {
    await harness.initialize("StreamableHTTP");
    initialConfig = harness.services.config.getConfig();
  });

  afterAll(async () => {
    await harness.shutdown();
  });

  afterEach(async () => {
    await harness.services.config.withLock(async () => {
      await harness.services.config.updateConfig(initialConfig);
    });
  });

  // ==================== TOOL GROUPS ====================

  describe("Tool Groups", () => {
    const BASE = `${CONFIG_BASE}/tool-groups`;

    it("initial GET returns empty array", async () => {
      const res = await fetch(BASE);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("GET by name returns 404 for non-existent", async () => {
      const res = await fetch(`${BASE}/nonexistent`);
      expect(res.status).toBe(404);
    });

    describe("lifecycle", () => {
      it("create -> getAll -> get -> update -> getAll -> delete -> getAll", async () => {
        const group = { name: "test-group", services: { svc: ["tool1"] } };

        // POST - create
        const createRes = await post(BASE, group);
        expect(createRes.status).toBe(201);
        expect(await createRes.json()).toMatchObject(group);

        // GET all - verify appears in list
        const getAllRes = await fetch(BASE);
        expect(getAllRes.status).toBe(200);
        const allGroups = await getAllRes.json();
        expect(allGroups).toHaveLength(1);
        expect(allGroups[0].name).toBe("test-group");

        // GET by name
        const getRes = await fetch(`${BASE}/test-group`);
        expect(getRes.status).toBe(200);
        expect(await getRes.json()).toMatchObject(group);

        // PUT - update
        const updates = { services: { svc: ["tool1", "tool2"] } };
        const updateRes = await put(`${BASE}/test-group`, updates);
        expect(updateRes.status).toBe(200);
        const updated = await updateRes.json();
        expect(updated.services.svc).toContain("tool2");

        // GET all after update - still has 1
        const getAllAfterUpdate = await fetch(BASE);
        expect(await getAllAfterUpdate.json()).toHaveLength(1);

        // DELETE
        const deleteRes = await del(`${BASE}/test-group`);
        expect(deleteRes.status).toBe(200);

        // GET all after delete - empty
        const getAllAfterDelete = await fetch(BASE);
        expect(await getAllAfterDelete.json()).toEqual([]);
      });
    });

    describe("edge cases", () => {
      it("cannot update non-existent group (404)", async () => {
        const res = await put(`${BASE}/nonexistent`, { services: {} });
        expect(res.status).toBe(404);
      });

      it("cannot create duplicate group (409)", async () => {
        const group = { name: "dup-group", services: {} };
        const firstRes = await post(BASE, group);
        expect(firstRes.status).toBe(201);

        const dupRes = await post(BASE, group);
        expect(dupRes.status).toBe(409);
      });

      it("cannot delete non-existent group (404)", async () => {
        const res = await del(`${BASE}/nonexistent`);
        expect(res.status).toBe(404);
      });

      it("returns 400 on invalid schema for create", async () => {
        const res = await post(BASE, { invalid: "data" });
        expect(res.status).toBe(400);
      });

      it("returns 400 on invalid schema for update", async () => {
        const group = { name: "valid-group", services: { svc: ["tool1"] } };
        await post(BASE, group);

        const res = await put(`${BASE}/valid-group`, {
          services: "not-an-object",
        });
        expect(res.status).toBe(400);
      });

      it("cannot delete tool group referenced by permission", async () => {
        // Create a tool group
        const createGroupRes = await post(BASE, {
          name: "referenced-group",
          services: { svc: "*" },
        });
        expect(createGroupRes.status).toBe(201);

        // Create a consumer that references this group
        const createConsumerRes = await post(
          `${CONFIG_BASE}/permissions/consumers`,
          {
            name: "ref-consumer",
            config: { _type: "default-block", allow: ["referenced-group"] },
          },
        );
        expect(createConsumerRes.status).toBe(201);

        // Try to delete the tool group - should fail (config validation rejects)
        const deleteRes = await del(`${BASE}/referenced-group`);
        expect(deleteRes.status).toBe(500);

        // Verify group still exists
        const getRes = await fetch(`${BASE}/referenced-group`);
        expect(getRes.status).toBe(200);
      });
    });

    describe("update description", () => {
      it("can update the description of a tool group", async () => {
        const group = {
          name: "test-group",
          services: { svc: ["tool1"] },
          description: "test description",
        };
        await post(BASE, group);

        const updateRes = await put(`${BASE}/test-group`, {
          description: "new test description",
          services: { svc: ["tool1"] },
        });
        expect(updateRes.status).toBe(200);
        expect((await updateRes.json()).description).toBe(
          "new test description",
        );

        // GET by name
        const getRes = await fetch(`${BASE}/test-group`);
        expect(getRes.status).toBe(200);
        expect(await getRes.json()).toMatchObject({
          ...group,
          description: "new test description",
        });
      });
    });

    describe("rename scenarios", () => {
      it("can rename a tool group", async () => {
        const group = { name: "original-name", services: { svc: ["tool1"] } };
        await post(BASE, group);

        // Rename the group
        const updateRes = await put(`${BASE}/original-name`, {
          name: "new-name",
          services: { svc: ["tool1"] },
        });
        expect(updateRes.status).toBe(200);
        expect((await updateRes.json()).name).toBe("new-name");

        // GET by new name should succeed
        const getNewRes = await fetch(`${BASE}/new-name`);
        expect(getNewRes.status).toBe(200);

        // GET by old name should 404
        const getOldRes = await fetch(`${BASE}/original-name`);
        expect(getOldRes.status).toBe(404);
      });

      it("cannot rename to an existing name (409)", async () => {
        const groupA = { name: "group-a", services: {} };
        const groupB = { name: "group-b", services: {} };
        await post(BASE, groupA);
        await post(BASE, groupB);

        // Try to rename group-a to group-b
        const updateRes = await put(`${BASE}/group-a`, {
          name: "group-b",
          services: {},
        });
        expect(updateRes.status).toBe(409);
      });

      it("leaves permissions intact when rename fails due to name clash", async () => {
        // Create two tool groups
        const groupA = { name: "clash-group-a", services: { svc: "*" } };
        const groupB = { name: "clash-group-b", services: { svc: "*" } };
        await post(BASE, groupA);
        await post(BASE, groupB);

        // Create a consumer permission referencing group-a
        await post(`${CONFIG_BASE}/permissions/consumers`, {
          name: "clash-consumer",
          config: { _type: "default-block", allow: ["clash-group-a"] },
        });

        // Try to rename group-a to group-b (should fail)
        const updateRes = await put(`${BASE}/clash-group-a`, {
          name: "clash-group-b",
          services: { svc: "*" },
        });
        expect(updateRes.status).toBe(409);

        // Verify the permission still references the original name
        const consumerRes = await fetch(
          `${CONFIG_BASE}/permissions/consumers/clash-consumer`,
        );
        const consumer = await consumerRes.json();
        expect(consumer.allow).toContain("clash-group-a");
        expect(consumer.allow).not.toContain("clash-group-b");
      });

      it("updates permissions when tool group is renamed", async () => {
        // Create a tool group
        const group = { name: "my-group", services: { svc: "*" } };
        await post(BASE, group);

        // Create multiple consumer permissions referencing this group
        await post(`${CONFIG_BASE}/permissions/consumers`, {
          name: "consumer-1",
          config: { _type: "default-block", allow: ["my-group"] },
        });
        await post(`${CONFIG_BASE}/permissions/consumers`, {
          name: "consumer-2",
          config: { _type: "default-block", allow: ["my-group"] },
        });

        // Rename the tool group
        const updateRes = await put(`${BASE}/my-group`, {
          name: "renamed-group",
          services: { svc: "*" },
        });
        expect(updateRes.status).toBe(200);

        // Check that both consumer permissions now reference the new name
        const consumer1Res = await fetch(
          `${CONFIG_BASE}/permissions/consumers/consumer-1`,
        );
        const consumer1 = await consumer1Res.json();
        expect(consumer1.allow).toContain("renamed-group");
        expect(consumer1.allow).not.toContain("my-group");

        const consumer2Res = await fetch(
          `${CONFIG_BASE}/permissions/consumers/consumer-2`,
        );
        const consumer2 = await consumer2Res.json();
        expect(consumer2.allow).toContain("renamed-group");
        expect(consumer2.allow).not.toContain("my-group");
      });

      it("updates default permission when tool group is renamed", async () => {
        // Create a tool group
        const group = { name: "default-perm-group", services: { svc: "*" } };
        await post(BASE, group);

        // Set default permission to block this group
        await put(`${CONFIG_BASE}/permissions/default`, {
          _type: "default-allow",
          block: ["default-perm-group"],
        });

        // Rename the tool group
        const updateRes = await put(`${BASE}/default-perm-group`, {
          name: "renamed-default-perm-group",
          services: { svc: "*" },
        });
        expect(updateRes.status).toBe(200);

        // Check that default permission now references the new name
        const defaultRes = await fetch(`${CONFIG_BASE}/permissions/default`);
        const defaultPerm = await defaultRes.json();
        expect(defaultPerm.block).toContain("renamed-default-perm-group");
        expect(defaultPerm.block).not.toContain("default-perm-group");
      });

      it("allows rename to same name (no-op on name)", async () => {
        const group = { name: "same-name-group", services: { svc: ["tool1"] } };
        await post(BASE, group);

        // "Rename" to the same name but update services
        const updateRes = await put(`${BASE}/same-name-group`, {
          name: "same-name-group",
          services: { svc: ["tool1", "tool2"] },
        });
        expect(updateRes.status).toBe(200);

        // Verify the group still exists with updated services
        const getRes = await fetch(`${BASE}/same-name-group`);
        expect(getRes.status).toBe(200);
        const updated = await getRes.json();
        expect(updated.name).toBe("same-name-group");
        expect(updated.services.svc.length).toBe(2);
        expect(updated.services.svc).toContain("tool1");
        expect(updated.services.svc).toContain("tool2");
      });
    });
  });

  // ==================== TOOL EXTENSIONS ====================

  describe("Tool Extensions", () => {
    const BASE = `${CONFIG_BASE}/tool-extensions`;
    // A util to build tool extension paths, which require server name, base tool name, and custom tool name
    const extPath = (server: string, baseTool: string, customTool: string) =>
      `${BASE}/${server}/${baseTool}/${customTool}`;

    it("initial GET returns empty services", async () => {
      const res = await fetch(BASE);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ services: {} });
    });

    it("GET by path returns 404 for non-existent", async () => {
      const res = await fetch(extPath("no-server", "no-tool", "no-ext"));
      expect(res.status).toBe(404);
    });

    describe("lifecycle", () => {
      it("create -> getAll -> get -> update -> getAll -> delete -> getAll", async () => {
        const ext1 = { name: "custom-tool", overrideParams: {} };
        const ext2 = { name: "another-custom-tool", overrideParams: {} };

        // POST
        const createRes = await post(`${BASE}/my-server/original-tool`, ext1);
        expect(createRes.status).toBe(201);

        const createRes2 = await post(`${BASE}/my-server/original-tool`, ext2);
        expect(createRes2.status).toBe(201);

        // GET all - verify structure
        const getAllRes = await fetch(BASE);
        expect(getAllRes.status).toBe(200);
        const allExts = await getAllRes.json();
        expect(
          allExts.services["my-server"]["original-tool"].childTools,
        ).toHaveLength(2);

        // GET specific
        const getRes = await fetch(
          extPath("my-server", "original-tool", "custom-tool"),
        );
        expect(getRes.status).toBe(200);
        expect((await getRes.json()).name).toBe("custom-tool");

        const getRes2 = await fetch(
          extPath("my-server", "original-tool", "another-custom-tool"),
        );
        expect(getRes2.status).toBe(200);
        expect((await getRes2.json()).name).toBe("another-custom-tool");

        // PUT update
        const updates = { overrideParams: { param1: { value: "new" } } };
        const updateRes = await put(
          extPath("my-server", "original-tool", "custom-tool"),
          updates,
        );
        expect(updateRes.status).toBe(200);

        // GET all after update - still has 2
        const getAllAfterUpdate = await fetch(BASE);
        expect(
          (await getAllAfterUpdate.json()).services["my-server"][
            "original-tool"
          ].childTools,
        ).toHaveLength(2);

        // DELETE first extension
        const deleteRes = await del(
          extPath("my-server", "original-tool", "custom-tool"),
        );
        expect(deleteRes.status).toBe(200);

        // GET all after first delete - structure remains with 1 child tool
        const getAllAfterFirstDelete = await fetch(BASE);
        const afterFirstDelete = await getAllAfterFirstDelete.json();
        expect(
          afterFirstDelete.services["my-server"]["original-tool"].childTools,
        ).toHaveLength(1);

        // DELETE second extension
        const deleteRes2 = await del(
          extPath("my-server", "original-tool", "another-custom-tool"),
        );
        expect(deleteRes2.status).toBe(200);

        // GET all after second delete - structure remains but no child tools
        const getAllAfterDelete = await fetch(BASE);
        const afterDelete = await getAllAfterDelete.json();
        expect(
          afterDelete.services["my-server"]["original-tool"].childTools,
        ).toHaveLength(0);
      });
    });

    describe("edge cases", () => {
      it("cannot update non-existent extension (404)", async () => {
        const res = await put(extPath("no", "no", "no"), {
          overrideParams: {},
        });
        expect(res.status).toBe(404);
      });

      it("cannot create duplicate extension (409)", async () => {
        const ext = { name: "dup-ext", overrideParams: {} };
        const firstRes = await post(`${BASE}/srv/tool`, ext);
        expect(firstRes.status).toBe(201);

        const dupRes = await post(`${BASE}/srv/tool`, ext);
        expect(dupRes.status).toBe(409);
      });

      it("cannot delete non-existent extension (404)", async () => {
        const res = await del(extPath("no", "no", "no"));
        expect(res.status).toBe(404);
      });

      it("returns 400 on invalid schema", async () => {
        const res = await post(`${BASE}/srv/tool`, { invalid: "data" });
        expect(res.status).toBe(400);
      });
    });
  });

  // ==================== PERMISSIONS ====================

  describe("Permissions", () => {
    const BASE = `${CONFIG_BASE}/permissions`;

    it("GET permissions returns default + empty consumers + empty clientNames", async () => {
      const res = await fetch(BASE);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.default).toEqual({ _type: "default-allow", block: [] });
      expect(body.consumers).toEqual({});
      expect(body.clientNames).toEqual({});
    });

    describe("default permission", () => {
      it("GET and PUT default permission", async () => {
        // GET default
        const getRes = await fetch(`${BASE}/default`);
        expect(getRes.status).toBe(200);

        // PUT default (use empty allow array - groups must exist to be referenced)
        const newDefault = { _type: "default-block", allow: [] };
        const putRes = await put(`${BASE}/default`, newDefault);
        expect(putRes.status).toBe(200);
        expect((await putRes.json())._type).toBe("default-block");

        // GET again to verify
        const verifyRes = await fetch(`${BASE}/default`);
        expect((await verifyRes.json())._type).toBe("default-block");
      });

      it("returns 400 on invalid schema for default", async () => {
        const res = await put(`${BASE}/default`, { invalid: "data" });
        expect(res.status).toBe(400);
      });
    });

    // Both consumer-keyed and clientName-keyed permission entries share an identical CRUD contract.
    // Iterating over both scopes proves they behave the same; the dedicated cross-scope test below
    // proves writes don't leak between them.
    describe.each(["consumers", "clientNames"] as const)(
      "%s permission entries",
      (scope) => {
        it(`initial GET ${scope} = empty`, async () => {
          const res = await fetch(`${BASE}/${scope}`);
          expect(res.status).toBe(200);
          expect(await res.json()).toEqual({});
        });

        it("GET by name returns 404 for non-existent", async () => {
          const res = await fetch(`${BASE}/${scope}/nonexistent`);
          expect(res.status).toBe(404);
        });

        describe("lifecycle", () => {
          it("create -> getAll -> get -> update -> getAll -> delete -> getAll", async () => {
            const group1Name = `${scope}-admin-tools`;
            const group2Name = `${scope}-user-tools`;
            await post(`${CONFIG_BASE}/tool-groups`, {
              name: group1Name,
              services: { svc1: "*" },
            });
            await post(`${CONFIG_BASE}/tool-groups`, {
              name: group2Name,
              services: { svc2: ["read"] },
            });

            const entryName = `${scope}-test-entry`;
            const entry = {
              name: entryName,
              config: { _type: "default-block", allow: [group1Name] },
            };
            const createRes = await post(`${BASE}/${scope}`, entry);
            expect(createRes.status).toBe(201);
            const created = await createRes.json();
            expect(created._type).toBe("default-block");
            expect(created.allow).toContain(group1Name);

            const getAllRes = await fetch(`${BASE}/${scope}`);
            expect(getAllRes.status).toBe(200);
            const all = await getAllRes.json();
            expect(Object.keys(all)).toHaveLength(1);
            expect(all[entryName]).toBeDefined();

            const getRes = await fetch(`${BASE}/${scope}/${entryName}`);
            expect(getRes.status).toBe(200);
            expect((await getRes.json()).allow).toContain(group1Name);

            const updateRes = await put(`${BASE}/${scope}/${entryName}`, {
              _type: "default-allow",
              block: [group2Name],
            });
            expect(updateRes.status).toBe(200);
            const updated = await updateRes.json();
            expect(updated._type).toBe("default-allow");
            expect(updated.block).toContain(group2Name);

            const getAllAfterUpdate = await fetch(`${BASE}/${scope}`);
            expect(Object.keys(await getAllAfterUpdate.json())).toHaveLength(1);

            const getAfterUpdate = await fetch(`${BASE}/${scope}/${entryName}`);
            const afterUpdate = await getAfterUpdate.json();
            expect(afterUpdate._type).toBe("default-allow");
            expect(afterUpdate.block).toContain(group2Name);

            const deleteRes = await del(`${BASE}/${scope}/${entryName}`);
            expect(deleteRes.status).toBe(200);

            const getAllAfterDelete = await fetch(`${BASE}/${scope}`);
            expect(await getAllAfterDelete.json()).toEqual({});
          });
        });

        describe("edge cases", () => {
          it("cannot update non-existent (404)", async () => {
            const res = await put(`${BASE}/${scope}/nonexistent`, {
              block: [],
            });
            expect(res.status).toBe(404);
          });

          it("cannot create duplicate (409)", async () => {
            const entry = {
              name: `${scope}-dup-entry`,
              config: { block: [] },
            };
            const firstRes = await post(`${BASE}/${scope}`, entry);
            expect(firstRes.status).toBe(201);

            const dupRes = await post(`${BASE}/${scope}`, entry);
            expect(dupRes.status).toBe(409);
          });

          it("cannot create referencing non-existent tool group", async () => {
            const entry = {
              name: `${scope}-bad-entry`,
              config: { _type: "default-block", allow: ["nonexistent-group"] },
            };
            const res = await post(`${BASE}/${scope}`, entry);
            expect(res.status).toBe(500);
          });

          it("cannot delete non-existent (404)", async () => {
            const res = await del(`${BASE}/${scope}/nonexistent`);
            expect(res.status).toBe(404);
          });

          it("returns 400 on invalid schema", async () => {
            const res = await post(`${BASE}/${scope}`, { invalid: "data" });
            expect(res.status).toBe(400);
          });
        });
      },
    );

    describe("scope isolation", () => {
      it("a clientName entry does not appear under consumers (and vice versa)", async () => {
        // Write into clientNames only
        const clientEntry = {
          name: "isolation-only-in-clients",
          config: { _type: "default-block", allow: [] },
        };
        await post(`${BASE}/clientNames`, clientEntry);
        // Write into consumers only
        const consumerEntry = {
          name: "isolation-only-in-consumers",
          config: { _type: "default-block", allow: [] },
        };
        await post(`${BASE}/consumers`, consumerEntry);

        const allClients = await (await fetch(`${BASE}/clientNames`)).json();
        const allConsumers = await (await fetch(`${BASE}/consumers`)).json();
        expect(allClients["isolation-only-in-clients"]).toBeDefined();
        expect(allClients["isolation-only-in-consumers"]).toBeUndefined();
        expect(allConsumers["isolation-only-in-consumers"]).toBeDefined();
        expect(allConsumers["isolation-only-in-clients"]).toBeUndefined();

        // GET by name on the wrong scope returns 404
        expect(
          (await fetch(`${BASE}/consumers/isolation-only-in-clients`)).status,
        ).toBe(404);
        expect(
          (await fetch(`${BASE}/clientNames/isolation-only-in-consumers`))
            .status,
        ).toBe(404);

        // The unified GET /permissions surfaces both entries on their respective keys
        const unifiedRes = await fetch(BASE);
        expect(unifiedRes.status).toBe(200);
        const unified = await unifiedRes.json();

        expect(unified.consumers["isolation-only-in-consumers"]).toBeDefined();
        expect(unified.consumers["isolation-only-in-clients"]).toBeUndefined();

        expect(unified.clientNames["isolation-only-in-clients"]).toBeDefined();
        expect(
          unified.clientNames["isolation-only-in-consumers"],
        ).toBeUndefined();

        await del(`${BASE}/clientNames/isolation-only-in-clients`);
        await del(`${BASE}/consumers/isolation-only-in-consumers`);
      });

      it("same name in both scopes stores two independent entries with their own configs", async () => {
        // Real-life scenario: a user sets a consumer-tag named "cursor" AND from a client with clientName "cursor".
        // Funky but realistic. The two entries must be separate rows with their own configs.
        const sharedName = "cursor";
        const consumerCreate = await post(`${BASE}/consumers`, {
          name: sharedName,
          config: { _type: "default-block", allow: [] },
        });
        expect(consumerCreate.status).toBe(201);
        const clientCreate = await post(`${BASE}/clientNames`, {
          name: sharedName,
          config: { _type: "default-allow", block: [] },
        });
        expect(clientCreate.status).toBe(201);

        // Read each scope back — different configs round-trip independently.
        const consumerGet = await (
          await fetch(`${BASE}/consumers/${sharedName}`)
        ).json();
        expect(consumerGet._type).toBe("default-block");
        const clientGet = await (
          await fetch(`${BASE}/clientNames/${sharedName}`)
        ).json();
        expect(clientGet._type).toBe("default-allow");

        // Updating one scope must not touch the other.
        await put(`${BASE}/consumers/${sharedName}`, {
          _type: "default-allow",
          block: [],
        });
        const clientAfterConsumerUpdate = await (
          await fetch(`${BASE}/clientNames/${sharedName}`)
        ).json();
        expect(clientAfterConsumerUpdate._type).toBe("default-allow");
        expect(clientAfterConsumerUpdate.block).toEqual([]);

        // Deleting one scope must not delete the other.
        await del(`${BASE}/consumers/${sharedName}`);
        expect((await fetch(`${BASE}/consumers/${sharedName}`)).status).toBe(
          404,
        );
        expect((await fetch(`${BASE}/clientNames/${sharedName}`)).status).toBe(
          200,
        );

        await del(`${BASE}/clientNames/${sharedName}`);
      });
    });
  });

  // ==================== FULL INTEGRATION ====================

  describe("Full Config Integration", () => {
    it("creates tool groups, permissions, and extensions, then verifies in config", async () => {
      // 1. Create a tool group
      const group = { name: "integration-group", services: { svc: "*" } };
      await post(`${CONFIG_BASE}/tool-groups`, group);

      // 2. Create a consumer that references the group
      const consumer = {
        name: "integration-consumer",
        config: { _type: "default-block", allow: ["integration-group"] },
      };
      await post(`${CONFIG_BASE}/permissions/consumers`, consumer);

      // 3. Create a tool extension
      const ext = { name: "custom-ext", overrideParams: {} };
      await post(`${CONFIG_BASE}/tool-extensions/svc/some-tool`, ext);

      // 4. Verify full config contains all created resources
      const config = harness.services.config.getConfig();
      expect(
        config.toolGroups.some((g) => g.name === "integration-group"),
      ).toBe(true);
      expect(
        config.permissions.consumers["integration-consumer"],
      ).toBeDefined();
      expect(
        config.toolExtensions.services["svc"]?.["some-tool"]?.childTools.some(
          (t) => t.name === "custom-ext",
        ),
      ).toBe(true);

      // 5. Snapshot the full config structure for stability
      expect(config).toMatchSnapshot();
    });
  });
});
