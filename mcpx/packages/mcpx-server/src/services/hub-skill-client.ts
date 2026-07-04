import { Skill, SkillDraft } from "@mcpx/shared-model";
import {
  deleteSkillAckSchema,
  skillWriteAckSchema,
  wrapInEnvelope,
} from "@mcpx/webapp-protocol/messages";
import { Logger } from "winston";
import { HubSocketAdapter } from "./saved-setups-client.js";
import { SkillHubClient } from "./skill-store.js";

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

  createSkill(draft: SkillDraft): Promise<Skill> {
    return this.writeSkill("save-skill", draft);
  }

  updateSkill(id: string, draft: SkillDraft): Promise<Skill> {
    return this.writeSkill("update-skill", { ...draft, id });
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

  private async writeSkill(
    event: "save-skill" | "update-skill",
    payload: unknown,
  ): Promise<Skill> {
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
