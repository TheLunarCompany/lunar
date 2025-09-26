import z from "zod/v4";
import { toolGroupSchema, authSchema, ParamExtensionOverrideValue } from "./config.js";

// TODO: move to all usages to nextVersionAppConfigSchema (/NextVersionAppConfigSchema)
// and remove this schema & rename everything.
// In deprecation, use newPermissionsSchema instead (will be renamed to permissionsSchema when migration is complete)

export const oldPermissionsSchema = z.object({
  base: z.enum(["allow", "block"]),
  consumers: z
    .record(
      z.string(),
      z.object({
        consumerGroupKey: z.string().optional().default(""),
        base: z.enum(["allow", "block"]).optional(),
        profiles: z
          .object({
            allow: z.array(z.string()).optional(),
            block: z.array(z.string()).optional(),
          })
          .default({ allow: [], block: [] }),
      })
    )
    .default({}),
});



  export const oldToolExtensionsParamsSchema : z.ZodType<{ [key: string]: ParamExtensionOverrideValue }> = z.lazy(() =>
  z
    .record(
      z.string(),
      z.union([
        z.null(),
        z.string(),
        z.number(),
        z.boolean(),
        z.record(
          z.string(),
          z.union([
            z.string(),
            z.number(),
            z.boolean(),
            oldToolExtensionsParamsSchema,
          ])
        ),
        z.array(
          z.union([
            z.string(),
            z.number(),
            z.boolean(),
            oldToolExtensionsParamsSchema,
          ])
        ),
      ])
    )
    .optional()
    .default({})
);

  
export const oldToolExtensionSchema = z.object({
  name: z.string(),
  description: z
    .object({
      action: z.enum(["append", "rewrite"]),
      text: z.string(),
    })
    .optional(),
  overrideParams: oldToolExtensionsParamsSchema,
});

export const oldToolExtensionsServiceSchema = z.record(
  z.string(),
  z.object({
    childTools: z.array(oldToolExtensionSchema),
  })
);

export const oldToolExtensionsSchema = z
  .object({
    services: z.record(z.string(), oldToolExtensionsServiceSchema),
  })
  .optional()
  .default({ services: {} });

export type OldToolExtension = z.infer<typeof oldToolExtensionSchema>;
export type OldToolExtensionsService = z.infer<typeof oldToolExtensionsServiceSchema>;
export type OldToolExtensions = z.infer<typeof oldToolExtensionsSchema>;

export const appConfigSchema = z.object({
  permissions: oldPermissionsSchema,
  toolGroups: toolGroupSchema,
  auth: authSchema,
  toolExtensions: oldToolExtensionsSchema,
});
export type AppConfig = z.infer<typeof appConfigSchema>;
