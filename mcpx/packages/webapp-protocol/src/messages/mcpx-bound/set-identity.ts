import { userRoleSchema } from "@mcpx/shared-model/api";
import z from "zod/v4";

const spaceIdentitySchema = z.object({
  entityType: z.literal("space"),
});

const userIdentitySchema = z.object({
  entityType: z.literal("user"),
  role: userRoleSchema,
  displayName: z.string().optional(),
});

export const setIdentityPayloadSchema = z.discriminatedUnion("entityType", [
  spaceIdentitySchema,
  userIdentitySchema,
]);

export type UserRole = z.infer<typeof userRoleSchema>;
export type SetIdentityPayload = z.infer<typeof setIdentityPayloadSchema>;
