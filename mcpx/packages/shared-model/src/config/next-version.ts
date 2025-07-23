import z from "zod/v4";
import { authSchema, toolExtensionSchema, toolGroupSchema } from "./config";
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

export const permissionsSchema = z.union([
  oldPermissionsSchema,
  newPermissionsSchema,
]);
export const nextVersionAppConfigSchema = z.object({
  permissions: newPermissionsSchema,
  toolGroups: toolGroupSchema,
  auth: authSchema,
  toolExtensions: toolExtensionSchema,
});
