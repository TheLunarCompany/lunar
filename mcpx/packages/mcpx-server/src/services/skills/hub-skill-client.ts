import { SkillInput, SkillWithDraft } from "@mcpx/shared-model";
import {
  deleteSkillAckSchema,
  skillWriteAckSchema,
  WebappBoundPayloadOf,
  wrapInEnvelope,
} from "@mcpx/webapp-protocol/messages";
import { Logger } from "winston";
import { HubSocketAdapter } from "../saved-setups-client.js";
import {
  SaveDraftParams,
  SkillHubClient,
  StaleDraftBaseError,
} from "./skill-store.js";

// The client SkillStore owns. Turns each authoring call into an emit+ack round-trip and
// converts the ack union into the Promise<Skill>/throw contract SkillStore expects.
export class HubSkillClient implements SkillHubClient {
  private logger: Logger;

  constructor(
    private getSocket: () => HubSocketAdapter | null,
    logger: Logger,
  ) {
    this.logger = logger.child({ component: "HubSkillClient" });
  }

  createSkill(input: SkillInput): Promise<SkillWithDraft> {
    return this.writeSkill("save-skill", input);
  }

  updateSkill(id: string, input: SkillInput): Promise<SkillWithDraft> {
    return this.writeSkill("update-skill", { ...input, id });
  }

  publishSkill(id: string): Promise<SkillWithDraft> {
    return this.writeSkill("publish-skill", { id });
  }

  unpublishSkill(id: string): Promise<SkillWithDraft> {
    return this.writeSkill("unpublish-skill", { id });
  }

  saveDraft(params: SaveDraftParams): Promise<SkillWithDraft> {
    const { skillId, draft, baseUpdatedAt } = params;
    return this.writeSkill("save-skill-draft", {
      skillId,
      draft,
      baseUpdatedAt,
    });
  }

  discardDraft(skillId: string): Promise<SkillWithDraft> {
    return this.writeSkill("discard-skill-draft", { skillId });
  }

  async deleteSkill(id: string): Promise<void> {
    const socket = this.requireSocket();
    const envelope = wrapInEnvelope({ payload: { id } });
    this.logger.debug("Sending delete-skill to Hub", { id });
    const ack = await socket.emitWithAck("delete-skill", envelope);
    const parsed = deleteSkillAckSchema.safeParse(ack);
    if (!parsed.success) {
      throw new Error("Invalid delete-skill response from Hub");
    }
    if (!parsed.data.success) {
      throw new Error(parsed.data.error);
    }
  }

  private async writeSkill<
    E extends
      | "save-skill"
      | "update-skill"
      | "publish-skill"
      | "unpublish-skill"
      | "save-skill-draft"
      | "discard-skill-draft",
  >(event: E, payload: WebappBoundPayloadOf<E>): Promise<SkillWithDraft> {
    const socket = this.requireSocket();
    const envelope = wrapInEnvelope({ payload });
    this.logger.debug(`Sending ${event} to Hub`, {
      messageId: envelope.metadata.id,
    });
    const ack = await socket.emitWithAck(event, envelope);
    const parsed = skillWriteAckSchema.safeParse(ack);
    if (!parsed.success) {
      throw new Error(`Invalid ${event} response from Hub`);
    }
    if (!parsed.data.success) {
      if (parsed.data.errorCode === "stale_base") {
        throw new StaleDraftBaseError();
      }
      throw new Error(parsed.data.error);
    }
    return parsed.data.skill;
  }

  private requireSocket(): HubSocketAdapter {
    const socket = this.getSocket();
    if (!socket) {
      throw new Error("Not connected to Hub");
    }
    return socket;
  }
}
