import { SkillDraft } from "@mcpx/shared-model";
import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { HubSkillClient } from "./hub-skill-client.js";
import { HubSocketAdapter } from "../saved-setups-client.js";

// Deliberately diverges from `draft` (name, body) to prove the caller gets the Hub's stored
// record back, not an echo of what it sent.
const persisted = {
  id: "0193c5f0-0000-7000-8000-000000000001",
  name: "greet-canonicalized",
  description: "says hi",
  body: "Say hello, from the Hub.",
  exposeAsPrompt: true,
  capabilityGroup: {
    name: "web",
    items: [
      {
        catalogItemId: "0193c5f0-0000-7000-8000-00000000000a",
        tools: ["search"],
        prompts: ["summarize"],
      },
    ],
  },
  author: { setupOwnerId: "owner-1", displayName: "Alice" },
  updatedAt: "2026-01-02T00:00:00.000Z",
  publishedAt: null,
};

const draft: SkillDraft = {
  name: "greet",
  description: "says hi",
  body: "Say hello.",
  exposeAsPrompt: true,
  capabilityGroup: {
    name: "web",
    items: [
      {
        catalogItemId: "0193c5f0-0000-7000-8000-00000000000a",
        tools: ["search"],
        prompts: ["summarize"],
      },
    ],
  },
};

class FakeSocket implements HubSocketAdapter {
  calls: { event: string; payload: unknown }[] = [];

  constructor(private ack: unknown) {}

  emitWithAck(event: string, envelope: unknown): Promise<unknown> {
    this.calls.push({
      event,
      payload: (envelope as { payload: unknown }).payload,
    });
    return Promise.resolve(this.ack);
  }
}

function clientWith(socket: HubSocketAdapter | null): HubSkillClient {
  return new HubSkillClient(() => socket, noOpLogger);
}

describe("HubSkillClient", () => {
  describe("createSkill", () => {
    it("sends the draft but returns the Hub's stored skill", async () => {
      const socket = new FakeSocket({ success: true, skill: persisted });

      const skill = await clientWith(socket).createSkill(draft);

      expect(socket.calls).toEqual([{ event: "save-skill", payload: draft }]);
      expect(skill).toMatchObject({
        id: persisted.id,
        name: "greet-canonicalized",
        body: "Say hello, from the Hub.",
        author: persisted.author,
        capabilityGroup: persisted.capabilityGroup,
      });
      expect(skill.name).not.toBe(draft.name);
    });

    it("throws the Hub error when the ack reports failure", async () => {
      const socket = new FakeSocket({ success: false, error: "boom" });

      await expect(clientWith(socket).createSkill(draft)).rejects.toThrow(
        "boom",
      );
    });

    it("throws when the ack is malformed", async () => {
      const socket = new FakeSocket({ nonsense: true });

      await expect(clientWith(socket).createSkill(draft)).rejects.toThrow(
        "Invalid save-skill response from Hub",
      );
    });

    it("throws when not connected to Hub", async () => {
      await expect(clientWith(null).createSkill(draft)).rejects.toThrow(
        "Not connected to Hub",
      );
    });
  });

  describe("updateSkill", () => {
    it("emits update-skill with the id merged into the draft", async () => {
      const socket = new FakeSocket({ success: true, skill: persisted });

      const skill = await clientWith(socket).updateSkill("skill-1", draft);

      expect(skill.id).toBe(persisted.id);
      expect(socket.calls).toEqual([
        { event: "update-skill", payload: { ...draft, id: "skill-1" } },
      ]);
    });
  });

  // The ack-handling paths (failure, malformed, disconnected) are shared with
  // createSkill above; these only pin the event/payload mapping.
  describe("publishSkill", () => {
    it("emits publish-skill and returns the stamped skill", async () => {
      const stamped = { ...persisted, publishedAt: "2026-01-03T00:00:00.000Z" };
      const socket = new FakeSocket({ success: true, skill: stamped });

      const skill = await clientWith(socket).publishSkill(persisted.id);

      expect(socket.calls).toEqual([
        { event: "publish-skill", payload: { id: persisted.id } },
      ]);
      expect(skill.publishedAt).toEqual(new Date("2026-01-03T00:00:00.000Z"));
    });
  });

  describe("unpublishSkill", () => {
    it("emits unpublish-skill and returns the nullified skill", async () => {
      const published = {
        ...persisted,
        publishedAt: "2026-01-03T00:00:00.000Z",
      };
      const socket = new FakeSocket({
        success: true,
        skill: { ...published, publishedAt: null },
      });

      const skill = await clientWith(socket).unpublishSkill(published.id);

      expect(socket.calls).toEqual([
        { event: "unpublish-skill", payload: { id: persisted.id } },
      ]);
      expect(skill.publishedAt).toBeNull();
    });
  });

  describe("deleteSkill", () => {
    it("emits delete-skill and resolves on success", async () => {
      const socket = new FakeSocket({ success: true });

      await expect(
        clientWith(socket).deleteSkill("skill-1"),
      ).resolves.toBeUndefined();
      expect(socket.calls).toEqual([
        { event: "delete-skill", payload: { id: "skill-1" } },
      ]);
    });

    it("throws the Hub error when the ack reports failure", async () => {
      const socket = new FakeSocket({ success: false, error: "nope" });

      await expect(clientWith(socket).deleteSkill("skill-1")).rejects.toThrow(
        "nope",
      );
    });
  });
});
