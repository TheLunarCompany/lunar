import z from "zod/v4";
import { toolGroupSchema, authSchema, toolExtensionSchema } from "./config";

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
export const appConfigSchema = z.object({
  permissions: oldPermissionsSchema,
  toolGroups: toolGroupSchema,
  auth: authSchema,
  toolExtensions: toolExtensionSchema,
});
export type AppConfig = z.infer<typeof appConfigSchema>;
