import { z } from "zod/v4";
import {
  skillDraftOverlaySchema,
  skillInputSchema,
  skillWithDraftSchema,
} from "@mcpx/shared-model";
import { webappBoundAckSchema } from "../shared/ack.js";

export const saveSkillPayloadSchema = skillInputSchema;
export type SaveSkillPayload = z.output<typeof saveSkillPayloadSchema>;

export const updateSkillPayloadSchema = skillInputSchema.extend({
  id: z.uuidv7(),
});
export type UpdateSkillPayload = z.output<typeof updateSkillPayloadSchema>;

export const deleteSkillPayloadSchema = z.object({
  id: z.uuidv7(),
});
export type DeleteSkillPayload = z.output<typeof deleteSkillPayloadSchema>;

// Publish stamps publishedAt; unpublish nullifies it. Both ack with the updated skill.
export const publishSkillPayloadSchema = z.object({
  id: z.uuidv7(),
});
export type PublishSkillPayload = z.output<typeof publishSkillPayloadSchema>;

export const unpublishSkillPayloadSchema = z.object({
  id: z.uuidv7(),
});
export type UnpublishSkillPayload = z.output<
  typeof unpublishSkillPayloadSchema
>;

// Draft ops target a skill's single draft slot, hence skillId (not a draft id).
export const saveSkillDraftPayloadSchema = z.object({
  skillId: z.uuidv7(),
  draft: skillDraftOverlaySchema,
  baseUpdatedAt: z.coerce.date(),
});
export type SaveSkillDraftPayload = z.output<
  typeof saveSkillDraftPayloadSchema
>;

export const discardSkillDraftPayloadSchema = z.object({
  skillId: z.uuidv7(),
});
export type DiscardSkillDraftPayload = z.output<
  typeof discardSkillDraftPayloadSchema
>;

// Writes return the persisted resource, the same shape set-personal-skills
// carries (draft attached when one exists).
export const skillWriteAckSchema = webappBoundAckSchema({
  skill: skillWithDraftSchema,
});
export type SkillWriteAck = z.infer<typeof skillWriteAckSchema>;

export const deleteSkillAckSchema = webappBoundAckSchema({});
export type DeleteSkillAck = z.infer<typeof deleteSkillAckSchema>;
