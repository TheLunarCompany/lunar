import { z } from "zod/v4";
import { enabledSkillsSchema } from "../config/next-version.js";

// ============ Skill Domain Model ============
// A skill is inert instruction text (SKILL.md: name, description, body) plus an optional
// capability group. The single shape that gets authored, stored, pushed, adopted, and served.
// Lives in the lowest layer; the hub→MCPX wire format and the admin-ui API build on it.

const capabilitySelectionSchema = z.union([
  z.array(z.string()),
  z.literal("*"),
]);

export const skillNameSlugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
export const skillInputSchema = z.object({
  // name/description caps mirror the agentskills.io SKILL.md spec.
  name: z.string().trim().min(1).max(64).regex(skillNameSlugRegex),
  description: z.string().trim().min(1).max(1024),
  body: z.string().trim(),
  // Also project the Prompt / `/slash` face, not just the skill:// Resource.
  exposeAsPrompt: z.boolean().default(true),
  capabilityGroup: skillCapabilityGroupSchema.optional(),
});
export type SkillInput = z.infer<typeof skillInputSchema>;

// Authored core plus Hub-minted metadata.
// publishedAt is publish-time only; unpublish nullifies it, edits bump updatedAt, never publishedAt.
export const skillSchema = skillInputSchema.extend({
  id: z.uuidv7(),
  author: skillAuthorSchema,
  updatedAt: z.coerce.date(),
  publishedAt: z.coerce.date().nullable(),
});
export type Skill = z.infer<typeof skillSchema>;

// Unsaved edits overlaying a saved skill. name is excluded — it is the
// skill's identity (prompt name, frontmatter, catalog entry).
export const skillDraftOverlaySchema = skillInputSchema.omit({ name: true });
export type SkillDraftOverlay = z.infer<typeof skillDraftOverlaySchema>;

export const skillWithDraftSchema = skillSchema.extend({
  draft: skillDraftOverlaySchema.optional(),
});
export type SkillWithDraft = z.infer<typeof skillWithDraftSchema>;

export const skillCatalogResponseSchema = z.object({
  mine: z.array(skillWithDraftSchema),
  others: z.array(skillSchema),
});
export type SkillCatalogResponse = z.infer<typeof skillCatalogResponseSchema>;

// baseUpdatedAt = the updatedAt of the saved skill the draft was edited
// against; a mismatch on save means the skill moved underneath the draft.
export const saveSkillDraftRequestSchema = z.object({
  draft: skillDraftOverlaySchema,
  baseUpdatedAt: z.coerce.date(),
});
export type SaveSkillDraftRequest = z.input<typeof saveSkillDraftRequestSchema>;

export const upsertSkillRequestSchema = skillInputSchema;
export type UpsertSkillRequest = z.input<typeof upsertSkillRequestSchema>;

export const updateSkillDetailsRequestSchema = skillInputSchema.omit({
  capabilityGroup: true,
});
export type UpdateSkillDetailsRequest = z.input<
  typeof updateSkillDetailsRequestSchema
>;

export const updateSkillCapabilitiesRequestSchema = z.object({
  capabilityGroup: skillCapabilityGroupSchema.nullable().optional(),
});
export type UpdateSkillCapabilitiesRequest = z.input<
  typeof updateSkillCapabilitiesRequestSchema
>;

export const enabledSkillsResponseSchema = z.object({
  enabled: z.array(enabledSkillsSchema),
});
export type EnabledSkillsResponse = z.infer<typeof enabledSkillsResponseSchema>;

export const createSkillResponseSchema = skillSchema;
export type CreateSkillResponse = z.infer<typeof createSkillResponseSchema>;
