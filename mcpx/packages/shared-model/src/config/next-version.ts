import z from "zod/v4";
import {
  authSchema,
  ToolExtensionParamsRecord,
  toolGroupSchema,
} from "./config";
import { oldPermissionsSchema } from "./current-version";

export const defaultAllowConsumerConfig = z.object({
  consumerGroupKey: z.string().optional(),
  block: z.array(z.string()),
});
export const defaultBlockConsumerConfig = z.object({
  consumerGroupKey: z.string().optional(),
  allow: z.array(z.string()),
});

export const consumerConfigSchema = z
  .union([defaultAllowConsumerConfig, defaultBlockConsumerConfig])
  .transform((schema, ctx) => {
    if ("block" in schema) {
      return { _type: "default-allow" as const, ...schema };
    }
    if ("allow" in schema) {
      return { _type: "default-block" as const, ...schema };
    }
    ctx.addIssue({
      code: "custom",
      message: "ConsumerConfig must contain either `allow` or `block` keys",
    });
    return z.NEVER;
  });

export const newPermissionsSchema = z.object({
  default: consumerConfigSchema,
  consumers: z.record(z.string(), consumerConfigSchema),
});

export const defaultAllowConsumerCompatSchema = z.object({
  _type: z.literal("default-allow"),
  consumerGroupKey: z.string().optional(),
  block: z.array(z.string()),
});

export const defaultBlockConsumerCompatSchema = z.object({
  _type: z.literal("default-block"),
  consumerGroupKey: z.string().optional(),
  allow: z.array(z.string()),
});

// The UI uses monaco-editor to validate the user input
// with built-in validation via Zod through JSON Schema
// conversion, providing real-time feedback to users.
// However, not all Zod API's are compatible with JSON Schema
// so we can't use the original `consumerConfigSchema`,
// and must create a separate schema for compatibility.
// See also https://zod.dev/json-schema#unrepresentable
export const consumerConfigCompatSchema = z.discriminatedUnion("_type", [
  defaultAllowConsumerCompatSchema,
  defaultBlockConsumerCompatSchema,
]);

export const newPermissionsCompatSchema = z.object({
  default: consumerConfigCompatSchema,
  consumers: z.record(z.string(), consumerConfigCompatSchema),
});

export const newToolExtensionParamsSchema: z.ZodType<ToolExtensionParamsRecord> =
  z.lazy(() =>
    z
      .record(
        z.string(),
        z.object({
          value: z
            .union([
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
                  newToolExtensionParamsSchema,
                ])
              ),
              z.array(
                z.union([
                  z.string(),
                  z.number(),
                  z.boolean(),
                  newToolExtensionParamsSchema,
                ])
              ),
            ])
            .optional(),
          description: z
            .object({
              action: z.enum(["append", "rewrite"]),
              text: z.string(),
            })
            .optional(),
        })
      )
      .optional()
      .default({})
  );

// Define the new tool extension schema to match current version format
export const newToolExtensionSchema = z.object({
  name: z.string(),
  description: z
    .object({
      action: z.enum(["append", "rewrite"]),
      text: z.string(),
    })
    .optional(),
  overrideParams: newToolExtensionParamsSchema,
});

export const newToolExtensionsServiceSchema = z.record(
  z.string(),
  z.object({
    childTools: z.array(newToolExtensionSchema),
  })
);

// The main toolExtensions schema should use the service structure
export const newToolExtensionsMainSchema = z
  .object({
    services: z.record(z.string(), newToolExtensionsServiceSchema),
  })
  .optional()
  .default({ services: {} });

// Add type exports for the new schemas
export type NewToolExtensions = z.infer<typeof newToolExtensionParamsSchema>;
export type NewToolExtension = z.infer<typeof newToolExtensionSchema>;
export type NewToolExtensionsService = z.infer<
  typeof newToolExtensionsServiceSchema
>;
export type NewToolExtensionsMain = z.infer<typeof newToolExtensionsMainSchema>;
export type ConsumerConfig = z.infer<typeof consumerConfigSchema>;
export type NewPermissions = z.infer<typeof newPermissionsSchema>;

export const permissionsSchema = z.union([
  oldPermissionsSchema,
  newPermissionsSchema,
]);
export const nextVersionAppConfigSchema = z.object({
  permissions: newPermissionsSchema,
  toolGroups: toolGroupSchema,
  auth: authSchema,
  toolExtensions: newToolExtensionsMainSchema,
});
export const nextVersionAppConfigCompatSchema = z.object({
  permissions: newPermissionsCompatSchema,
  toolGroups: toolGroupSchema,
  auth: authSchema,
  toolExtensions: newToolExtensionsMainSchema,
});
