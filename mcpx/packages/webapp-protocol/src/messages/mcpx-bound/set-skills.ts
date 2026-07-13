import z from "zod/v4";
import { skillSchema } from "@mcpx/shared-model";

// Hub→MCPX skill push, per setup owner: only that owner's skills. No sharing yet, so this
// is the only stream. The full Skill rides the wire (same object authored, stored, served).
export const setPersonalSkillsPayloadSchema = z.object({
  skills: z.array(skillSchema),
});
export type SetPersonalSkillsPayload = z.infer<
  typeof setPersonalSkillsPayloadSchema
>;
