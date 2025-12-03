import z from "zod/v4";
import {
  authSchema,
  ToolExtensionParamsRecord,
  toolGroupSchema,
} from "./config.js";
import { oldPermissionsSchema } from "./current-version.js";

export const defaultAllowConsumerConfig = z.object({
  _type: z.literal("default-allow").optional(),
  consumerGroupKey: z.string().optional(),
  block: z.array(z.string()),
});

export const defaultBlockConsumerConfig = z.object({
  _type: z.literal("default-block").optional(),
  consumerGroupKey: z.string().optional(),
  allow: z.array(z.string()),
});

export const consumerConfigSchema = z.union([
  defaultAllowConsumerConfig,
  defaultBlockConsumerConfig,
]);

export const newPermissionsSchema = z.object({
  default: consumerConfigSchema,
  consumers: z.record(z.string(), consumerConfigSchema),
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

// Add type exports for the new schemas
export type NewToolExtensions = z.infer<typeof newToolExtensionParamsSchema>;
export type NewToolExtension = z.infer<typeof newToolExtensionSchema>;
export type NewToolExtensionsService = z.infer<
  typeof newToolExtensionsServiceSchema
>;
export type NewToolExtensionsMain = z.infer<typeof newToolExtensionsMainSchema>;
export type ConsumerConfig = z.infer<typeof consumerConfigSchema>;
export type NewPermissions = z.infer<typeof newPermissionsSchema>;
export type StaticOAuthProvider = z.infer<typeof staticOAuthProviderSchema>;
export type StaticOAuth = z.infer<typeof staticOAuthSchema>;

export const permissionsSchema = z.union([
  oldPermissionsSchema,
  newPermissionsSchema,
]);
export const nextVersionAppConfigSchema = z.object({
  permissions: newPermissionsSchema,
  toolGroups: toolGroupSchema,
  auth: authSchema,
  toolExtensions: newToolExtensionsMainSchema,
  targetServerAttributes: targetServerAttributesSchema,
  staticOauth: staticOAuthSchema,
});
