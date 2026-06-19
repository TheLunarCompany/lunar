import { userRoleSchema } from "@mcpx/shared-model/api";
import z from "zod/v4";

// Present when an admin is currently editing this space on its behalf (OBO).
const oboEditorSchema = z.object({
  adminDisplayName: z.string().optional(),
  adminEmail: z.string().optional(),
});

// Present on a user's own identity while they have an active OBO edit elsewhere.
const oboEditingTargetSchema = z.object({
  spaceName: z.string().optional(),
});

const spaceKindSchema = z.enum([
  "HOSTED_MCP_SERVER",
  "AGENT_CONNECTOR",
  "SANDBOX_ANALYSIS",
]);

const spaceIdentitySchema = z.object({
  entityType: z.literal("space"),
  spaceKind: spaceKindSchema.optional(),
  spaceName: z.string().optional(),
  editedBy: oboEditorSchema.optional(),
});

const userIdentitySchema = z.object({
  entityType: z.literal("user"),
  role: userRoleSchema,
  displayName: z.string().optional(),
  editingOnBehalfOf: oboEditingTargetSchema.optional(),
});

export const setIdentityPayloadSchema = z.discriminatedUnion("entityType", [
  spaceIdentitySchema,
  userIdentitySchema,
]);

export type UserRole = z.infer<typeof userRoleSchema>;
export type OboEditor = z.infer<typeof oboEditorSchema>;
export type OboEditingTarget = z.infer<typeof oboEditingTargetSchema>;
export type SpaceKind = z.infer<typeof spaceKindSchema>;
export type SetIdentityPayload = z.infer<typeof setIdentityPayloadSchema>;
