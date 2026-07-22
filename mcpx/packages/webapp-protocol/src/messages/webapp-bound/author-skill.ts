import { z } from "zod/v4";
import { skillDraftSchema, skillSchema } from "@mcpx/shared-model";

export const saveSkillPayloadSchema = skillDraftSchema;
export type SaveSkillPayload = z.output<typeof saveSkillPayloadSchema>;

export const updateSkillPayloadSchema = skillDraftSchema.extend({
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

export const skillErrorCodeSchema = z.enum(["not_found"]);
export type SkillErrorCode = z.infer<typeof skillErrorCodeSchema>;

// save and update return the persisted resource, the same skillSchema set-skills carries.
export const skillWriteAckSchema = z.discriminatedUnion("success", [
  z.object({ success: z.literal(true), skill: skillSchema }),
  z.object({
    success: z.literal(false),
    error: z.string(),
    errorCode: skillErrorCodeSchema.optional(),
  }),
]);
export type SkillWriteAck = z.infer<typeof skillWriteAckSchema>;

export const deleteSkillAckSchema = z.discriminatedUnion("success", [
  z.object({ success: z.literal(true) }),
  z.object({
    success: z.literal(false),
    error: z.string(),
    errorCode: skillErrorCodeSchema.optional(),
  }),
]);
export type DeleteSkillAck = z.infer<typeof deleteSkillAckSchema>;
