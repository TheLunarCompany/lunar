import { z } from "zod/v4";

// ============ Skill Domain Model ============
// A skill is inert instruction text (SKILL.md: name, description, body) plus an optional
// capability group. The single shape that gets authored, stored, pushed, adopted, and served.
// Lives in the lowest layer; the hub→MCPX wire format and the admin-ui API build on it.

const capabilitySelectionSchema = z.union([
  z.array(z.string()),
  z.literal("*"),
]);

// Per catalog item, the tools and prompts this skill's capability group selects.
// Either list may be "*" (all from that item) or empty (none).
export const skillCapabilityGroupItemSchema = z.object({
  catalogItemId: z.uuid(),
  tools: capabilitySelectionSchema,
  prompts: capabilitySelectionSchema,
});
export type SkillCapabilityGroupItem = z.infer<
  typeof skillCapabilityGroupItemSchema
>;

export const skillCapabilityGroupSchema = z.object({
  name: z.string().optional(),
  items: z.array(skillCapabilityGroupItemSchema),
});
export type SkillCapabilityGroup = z.infer<typeof skillCapabilityGroupSchema>;

// displayName powers "by <author>" attribution.
export const skillAuthorSchema = z.object({
  setupOwnerId: z.string(),
  displayName: z.string(),
});
export type SkillAuthor = z.infer<typeof skillAuthorSchema>;

// The authored core, before Hub mints metadata.
export const skillDraftSchema = z.object({
  // name/description caps mirror the agentskills.io SKILL.md spec.
  name: z.string().max(64),
  description: z.string().max(1024),
  body: z.string(),
  // Also project the Prompt / `/slash` face, not just the skill:// Resource.
  exposeAsPrompt: z.boolean().default(true),
  capabilityGroup: skillCapabilityGroupSchema.optional(),
});
export type SkillDraft = z.infer<typeof skillDraftSchema>;

// Authored core plus Hub-minted metadata.
export const skillSchema = skillDraftSchema.extend({
  id: z.uuidv7(),
  author: skillAuthorSchema,
  updatedAt: z.coerce.date(),
});
export type Skill = z.infer<typeof skillSchema>;
