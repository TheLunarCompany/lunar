import z from "zod/v4";

import { authSchema, ParamExtensionOverrideValue, toolGroupSchema } from "./config";
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

type ExtensionDescription = {
  action: "append" | "rewrite";
  text: string;
};

type ToolExtension = {
    [paramName: string]: {
      value?: ParamExtensionOverrideValue;
      description?: ExtensionDescription;
    };
  };

export const newToolExtensionParamsSchema: z.ZodType<ToolExtension> = z.lazy(() =>
  z
    .record(
      z.string(),
      z.object({
        value: z.union([
          z.null(),
          z.undefined(),
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
        description: z.object({
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
export type NewToolExtensionsService = z.infer<typeof newToolExtensionsServiceSchema>;
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
