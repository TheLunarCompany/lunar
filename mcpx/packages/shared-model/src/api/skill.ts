import { z } from "zod/v4";

// ============ Skill Domain Model ============
// A skill is inert instruction text (SKILL.md: name, description, body) plus an optional
// tool group. The single shape that gets authored, stored, pushed, adopted, and served.
// Lives in the lowest layer; the hub→MCPX wire format and the admin-ui API build on it.

// Distinct from setup tool groups, which key items by server name. A shared skill must
// reference catalog items everyone can resolve, so items carry the stable catalogItemId.
export const catalogItemIdSchema = z.string().brand<"CatalogItemId">();
export type CatalogItemId = z.infer<typeof catalogItemIdSchema>;

// Similar to toolGroup schema from Setup, but different semantics.
// Stored as an array, not a record: keeps the CatalogItemId brand (zod strips brands on
// record keys) and stays extensible. Build a Map at lookup sites for O(1). "*" = all tools.
export const skillToolGroupItemSchema = z.object({
  catalogItemId: catalogItemIdSchema,
  tools: z.union([z.array(z.string()), z.literal("*")]),
});
export type SkillToolGroupItem = z.infer<typeof skillToolGroupItemSchema>;

export const skillToolGroupSchema = z.object({
  name: z.string().optional(),
  items: z.array(skillToolGroupItemSchema),
});
export type SkillToolGroup = z.infer<typeof skillToolGroupSchema>;

// setupOwnerId decides mine-vs-others in MCPX; displayName powers "by <author>".
export const skillAuthorSchema = z.object({
  setupOwnerId: z.string(),
  displayName: z.string(),
});
export type SkillAuthor = z.infer<typeof skillAuthorSchema>;

// null = active; presence = soft-deleted (powers un-serve with a reason).
export const skillDeletionSchema = z.object({
  bySetupOwnerId: z.string(),
  reason: z.string().optional(),
});
export type SkillDeletion = z.infer<typeof skillDeletionSchema>;

// The authored core, before Hub mints metadata.
export const skillDraftSchema = z.object({
  name: z.string(),
  description: z.string(),
  body: z.string(),
  // Also project the Prompt / `/slash` face, not just the skill:// Resource.
  exposeAsPrompt: z.boolean().default(true),
  toolGroup: skillToolGroupSchema.optional(),
});
export type SkillDraft = z.infer<typeof skillDraftSchema>;

// Authored core plus Hub-minted metadata.
export const skillSchema = skillDraftSchema.extend({
  id: z.uuidv7(),
  author: skillAuthorSchema,
  isShared: z.boolean(),
  deletion: skillDeletionSchema.nullable().default(null),
  updatedAt: z.coerce.date(),
});
export type Skill = z.infer<typeof skillSchema>;
