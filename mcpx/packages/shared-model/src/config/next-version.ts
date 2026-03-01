import z from "zod/v4";
import {
  authSchema,
  ToolExtensionParamsRecord,
  toolGroupSchema,
} from "./config.js";

export const defaultAllowConsumerConfig = z.object({
  _type: z.literal("default-allow"),
  consumerGroupKey: z.string().optional(),
  block: z.array(z.string()),
});

export const defaultBlockConsumerConfig = z.object({
  _type: z.literal("default-block"),
  consumerGroupKey: z.string().optional(),
  allow: z.array(z.string()),
});

function inferConsumerConfigType(val: unknown): unknown {
  if (val && typeof val === "object" && !("_type" in val)) {
    if ("allow" in val) return { ...val, _type: "default-block" };
    if ("block" in val) return { ...val, _type: "default-allow" };
  }
  return val;
}

export const consumerConfigSchema = z.preprocess(
  inferConsumerConfigType,
  z.union([defaultAllowConsumerConfig, defaultBlockConsumerConfig]),
);

export const permissionsSchema = z.object({
  default: consumerConfigSchema,
  consumers: z.record(z.string(), consumerConfigSchema),
});

export const toolExtensionParamsSchema: z.ZodType<ToolExtensionParamsRecord> =
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
                  toolExtensionParamsSchema,
                ]),
              ),
              z.array(
                z.union([
                  z.string(),
                  z.number(),
                  z.boolean(),
                  toolExtensionParamsSchema,
                ]),
              ),
            ])
            .optional(),
          description: z
            .object({
              action: z.enum(["append", "rewrite"]),
              text: z.string(),
            })
            .optional(),
        }),
      )
      .optional()
      .default({}),
  );

export const toolExtensionSchema = z.object({
  name: z.string(),
  description: z
    .object({
      action: z.enum(["append", "rewrite"]),
      text: z.string(),
    })
    .optional(),
  overrideParams: toolExtensionParamsSchema,
});

export const toolExtensionsServiceSchema = z.record(
  z.string(),
  z.object({
    childTools: z.array(toolExtensionSchema),
  }),
);

export const toolExtensionsSchema = z
  .object({
    services: z.record(z.string(), toolExtensionsServiceSchema),
  })
  .optional()
  .default({ services: {} });

// Static OAuth schemas
// Client credentials flow (traditional OAuth with client secret)
const clientCredentialsProviderSchema = z.object({
  authMethod: z.literal("client_credentials"),
  credentials: z.object({
    clientIdEnv: z.string(),
    clientSecretEnv: z.string(),
  }),
  scopes: z.array(z.string()),
  tokenAuthMethod: z.enum([
    "client_secret_basic",
    "client_secret_post",
    "client_secret_jwt",
    "private_key_jwt",
    "tls_client_auth",
    "self_signed_tls_client_auth",
  ]),
});

// Device flow (no client secret needed, user authorizes via browser)
const deviceFlowProviderSchema = z.object({
  authMethod: z.literal("device_flow"),
  credentials: z.object({
    clientIdEnv: z.string().min(1),
    // No clientSecretEnv needed for device flow
  }),
  scopes: z.array(z.string()),
  // Device flow specific endpoints (required for each provider)
  endpoints: z.object({
    deviceAuthorizationUrl: z.string(), // e.g., https://github.com/login/device/code
    tokenUrl: z.string(), // e.g., https://github.com/login/oauth/access_token
    userVerificationUrl: z.string(), // e.g., https://github.com/login/device
  }),
});

export const singleServerAttributesSchema = z.object({
  inactive: z.boolean(),
});

export const targetServerAttributesSchema = z
  .record(z.string(), singleServerAttributesSchema)
  .optional()
  .default({});

// Discriminated union for OAuth provider types
export const staticOAuthProviderSchema = z.discriminatedUnion("authMethod", [
  clientCredentialsProviderSchema,
  deviceFlowProviderSchema,
]);

export const staticOAuthSchema = z
  .object({
    mapping: z.record(z.string(), z.string()), // domain -> provider key
    providers: z.record(z.string(), staticOAuthProviderSchema),
  })
  .optional();

// Type exports
export type ToolExtensionParams = z.infer<typeof toolExtensionParamsSchema>;
export type ToolExtension = z.infer<typeof toolExtensionSchema>;
export type ToolExtensionsService = z.infer<typeof toolExtensionsServiceSchema>;
export type ToolExtensions = z.infer<typeof toolExtensionsSchema>;
export type ConsumerConfig = z.infer<typeof consumerConfigSchema>;
export type Permissions = z.infer<typeof permissionsSchema>;

export const createPermissionConsumerRequestSchema = z.object({
  name: z.string(),
  config: consumerConfigSchema,
});
export type CreatePermissionConsumerRequest = z.infer<
  typeof createPermissionConsumerRequestSchema
>;
export type StaticOAuthProvider = z.infer<typeof staticOAuthProviderSchema>;
export type StaticOAuth = z.infer<typeof staticOAuthSchema>;

export const appConfigSchema = z.object({
  permissions: permissionsSchema,
  toolGroups: toolGroupSchema,
  auth: authSchema,
  toolExtensions: toolExtensionsSchema,
  targetServerAttributes: targetServerAttributesSchema,
  staticOauth: staticOAuthSchema,
});

export type AppConfig = z.infer<typeof appConfigSchema>;
