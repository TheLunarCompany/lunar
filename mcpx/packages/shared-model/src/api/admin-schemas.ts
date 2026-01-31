import { z } from "zod/v4";

export const userRoleSchema = z.enum(["admin", "member"]);
export type UserRole = z.infer<typeof userRoleSchema>;

const personalIdentitySchema = z.object({
  mode: z.literal("personal"),
});

const enterpriseIdentitySchema = z.object({
  mode: z.literal("enterprise"),
  entity: z.discriminatedUnion("entityType", [
    z.object({ entityType: z.literal("space") }),
    z.object({
      entityType: z.literal("user"),
      role: userRoleSchema,
    }),
  ]),
});

export const identitySchema = z.discriminatedUnion("mode", [
  personalIdentitySchema,
  enterpriseIdentitySchema,
]);

// GET /identity response (public)
export const getIdentityResponseSchema = z.object({
  identity: identitySchema,
});

// GET /admin/strictness and POST /admin/strictness response
export const strictnessResponseSchema = z.object({
  isStrict: z.boolean(),
  adminOverride: z.boolean(),
});

// POST /admin/strictness request
export const setStrictnessRequestSchema = z.object({
  override: z.boolean(),
});

// Type exports
export type Identity = z.infer<typeof identitySchema>;
export type GetIdentityResponse = z.infer<typeof getIdentityResponseSchema>;
export type StrictnessResponse = z.infer<typeof strictnessResponseSchema>;
export type SetStrictnessRequest = z.infer<typeof setStrictnessRequestSchema>;
