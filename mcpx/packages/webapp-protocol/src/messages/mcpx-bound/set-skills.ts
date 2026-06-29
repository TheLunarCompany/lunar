import z from "zod/v4";
import { skillSchema } from "@mcpx/shared-model";

// Hub→MCPX skill push, two streams. The shared stream is a broadcast: the same payload
// (every org-wide shared skill, including the recipient's own) goes to every instance, not
// personalized. The personal stream is per setup owner: only that owner's skills.
// This shared/personal split is the push channel, NOT MCPX's { mine, others } catalog
// partition. That partition is derived per viewer (personal stream = mine; shared stream
// minus my own = others), so a skill we authored and shared arrives on both streams.
// The full Skill rides the wire (same object authored, stored, adopted, served).

export const setSharedSkillsPayloadSchema = z.object({
  skills: z.array(skillSchema),
});
export type SetSharedSkillsPayload = z.infer<
  typeof setSharedSkillsPayloadSchema
>;

export const setPersonalSkillsPayloadSchema = z.object({
  skills: z.array(skillSchema),
});
export type SetPersonalSkillsPayload = z.infer<
  typeof setPersonalSkillsPayloadSchema
>;
