import z from "zod/v4";
import { skillSchema, skillWithDraftSchema } from "@mcpx/shared-model";

// Hub→MCPX skill pushes, two streams: per setup owner, all of that owner's skills
// (published or not); and broadcast to everyone, all published skills org-wide. MCPX
// derives mine/others by filtering the broadcast on author.setupOwnerId. The full
// Skill rides the wire (same object authored, stored, served). Drafts ride the
// personal stream only — they never leave their owner.
export const setPersonalSkillsPayloadSchema = z.object({
  skills: z.array(skillWithDraftSchema),
});
export type SetPersonalSkillsPayload = z.infer<
  typeof setPersonalSkillsPayloadSchema
>;

export const setPublishedSkillsPayloadSchema = z.object({
  skills: z.array(skillSchema),
});
export type SetPublishedSkillsPayload = z.infer<
  typeof setPublishedSkillsPayloadSchema
>;
