import {
  deleteSavedSetupAckSchema,
  listSavedSetupsAckSchema,
  saveSetupAckSchema,
  updateSavedSetupAckSchema,
  WebappBoundPayloadOf,
  wrapInEnvelope,
} from "@mcpx/webapp-protocol/messages";
import { Logger } from "winston";
import { z } from "zod/v4";

export interface SavedSetupsSocket {
  emitWithAck(event: string, envelope: unknown): Promise<unknown>;
}

export class SavedSetupsClient {
  private logger: Logger;

  constructor(
    private getSocket: () => SavedSetupsSocket | null,
    logger: Logger,
  ) {
    this.logger = logger.child({ component: "SavedSetupsClient" });
  }

  async saveSetup(
    payload: WebappBoundPayloadOf<"save-setup">,
  ): Promise<z.infer<typeof saveSetupAckSchema>> {
    const socket = this.getSocket();
    if (!socket) {
      return { success: false, error: "Not connected to Hub" };
    }
    const envelope = wrapInEnvelope({ payload });
    this.logger.debug("Sending save-setup to Hub", {
      messageId: envelope.metadata.id,
    });
    const ack = await socket.emitWithAck("save-setup", envelope);
    const parsed = saveSetupAckSchema.safeParse(ack);
    if (!parsed.success) {
      this.logger.error("Invalid save-setup ack from Hub", {
        error: parsed.error,
        ack,
      });
      return { success: false, error: "Invalid response from Hub" };
    }
    return parsed.data;
  }

  async listSavedSetups(): Promise<z.infer<typeof listSavedSetupsAckSchema>> {
    const socket = this.getSocket();
    if (!socket) {
      return { setups: [] };
    }
    const envelope = wrapInEnvelope({ payload: {} });
    this.logger.debug("Sending list-saved-setups to Hub");
    const ack = await socket.emitWithAck("list-saved-setups", envelope);
    const parsed = listSavedSetupsAckSchema.safeParse(ack);
    if (!parsed.success) {
      this.logger.error("Invalid list-saved-setups ack from Hub", {
        error: parsed.error,
        ack,
      });
      return { setups: [] };
    }
    return parsed.data;
  }

  async deleteSavedSetup(
    savedSetupId: string,
  ): Promise<z.infer<typeof deleteSavedSetupAckSchema>> {
    const socket = this.getSocket();
    if (!socket) {
      return { success: false, error: "Not connected to Hub" };
    }
    const envelope = wrapInEnvelope({ payload: { savedSetupId } });
    this.logger.debug("Sending delete-saved-setup to Hub", { savedSetupId });
    const ack = await socket.emitWithAck("delete-saved-setup", envelope);
    const parsed = deleteSavedSetupAckSchema.safeParse(ack);
    if (!parsed.success) {
      this.logger.error("Invalid delete-saved-setup ack from Hub", {
        error: parsed.error,
        ack,
      });
      return { success: false, error: "Invalid response from Hub" };
    }
    return parsed.data;
  }

  async updateSavedSetup(
    payload: WebappBoundPayloadOf<"update-saved-setup">,
  ): Promise<z.infer<typeof updateSavedSetupAckSchema>> {
    const socket = this.getSocket();
    if (!socket) {
      return { success: false, error: "Not connected to Hub" };
    }
    const envelope = wrapInEnvelope({ payload });
    this.logger.debug("Sending update-saved-setup to Hub", {
      savedSetupId: payload.savedSetupId,
    });
    const ack = await socket.emitWithAck("update-saved-setup", envelope);
    const parsed = updateSavedSetupAckSchema.safeParse(ack);
    if (!parsed.success) {
      this.logger.error("Invalid update-saved-setup ack from Hub", {
        error: parsed.error,
        ack,
      });
      return { success: false, error: "Invalid response from Hub" };
    }
    return parsed.data;
  }
}
