import z from "zod/v4";
import {
  consumerConfigSchema,
  nextVersionAppConfigCompatSchema,
  nextVersionAppConfigSchema,
} from "./next-version";

export const undiscriminatedConsumerConfigSchema =
  consumerConfigSchema.transform(({ _type, ...rest }) => rest);

export const publicNewPermissionsSchema = z.strictObject({
  default: undiscriminatedConsumerConfigSchema,
  consumers: z.record(z.string(), undiscriminatedConsumerConfigSchema),
});

export const publicNextVersionAppConfigSchema = nextVersionAppConfigSchema
  .omit({ permissions: true })
  .extend({ permissions: publicNewPermissionsSchema });

export type PublicNextVersionAppConfig = z.infer<
  typeof publicNextVersionAppConfigSchema
>;
export type NextVersionAppConfig = z.infer<typeof nextVersionAppConfigSchema>;
export type NextVersionAppConfigCompat = z.infer<
  typeof nextVersionAppConfigCompatSchema
>;
