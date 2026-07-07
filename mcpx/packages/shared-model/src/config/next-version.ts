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

// TODO RND-432 - rename to reflect that this isn't only for consumers — the same shape is used for `default`, `consumers[name]`, and `clientNames[name]`. Suggested: `permissionEntrySchema` / `PermissionEntry`.
export const consumerConfigSchema = z.preprocess(
  inferConsumerConfigType,
  z.union([defaultAllowConsumerConfig, defaultBlockConsumerConfig]),
);

export const permissionsSchema = z.object({
  default: consumerConfigSchema,
  consumers: z.record(z.string(), consumerConfigSchema),
  clientNames: z
    .record(z.string(), consumerConfigSchema)
    .optional()
    .default({}),
});

// Who a skill is enabled for. 
export const scopeSubjectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("consumerTag"), value: z.string().min(1) }),
  z.object({ kind: z.literal("clientName"), value: z.string().min(1) }),
]);
export type ScopeSubject = z.infer<typeof scopeSubjectSchema>;

// Canonical identity of a subject; use as Map key or for equality.
export function scopeSubjectKey(subject: ScopeSubject): string {
  return `${subject.kind}:${subject.value}`;
}

export function scopeSubjectsEqual(a: ScopeSubject, b: ScopeSubject): boolean {
  return scopeSubjectKey(a) === scopeSubjectKey(b);
}

export const enabledSkillsSchema = z.object({
  subject: scopeSubjectSchema,
  skillIds: z.array(z.uuid()),
});
export type EnabledSkills = z.infer<typeof enabledSkillsSchema>;

export const skillsConfigSchema = z
  .object({
    enabled: z.array(enabledSkillsSchema).default([]),
  })
  .optional()
  .default({ enabled: [] });
export type SkillsConfig = z.infer<typeof skillsConfigSchema>;

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
//
// Each credential field (clientId, clientSecret) is independently
// either a literal value or a reference to an env var. Both arrive
// from hub: literals tunneled in apply-setup, env-var refs resolved
// against env vars hub pushes via set-oauth-credentials (and the
// k8s-derived set-profile-secrets bucket on the target-server side).
// The two can be mixed per-field.
//
// Legacy whole-shape configs (literal-only or envRef-only at the
// `credentials` level) keep parsing — they transform to the new
// canonical per-field form so consumers see one normalized output.

const literalField = z.object({
  type: z.literal("literal"),
  value: z.string().min(1),
});
const envRefField = z.object({
  type: z.literal("envRef"),
  envName: z.string().min(1),
});
const credentialFieldSchema = z.discriminatedUnion("type", [
  literalField,
  envRefField,
]);

const clientCredentialsSchema = z.object({
  clientId: credentialFieldSchema,
  clientSecret: credentialFieldSchema,
});

const legacyLiteralClientCredentials = z
  .object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
  })
  .transform((c) => ({
    clientId: { type: "literal" as const, value: c.clientId },
    clientSecret: { type: "literal" as const, value: c.clientSecret },
  }));

const legacyEnvRefClientCredentials = z
  .object({
    clientIdEnv: z.string().min(1),
    clientSecretEnv: z.string().min(1),
  })
  .transform((c) => ({
    clientId: { type: "envRef" as const, envName: c.clientIdEnv },
    clientSecret: { type: "envRef" as const, envName: c.clientSecretEnv },
  }));

const effectiveClientCredentialsSchema = z.union([
  clientCredentialsSchema,
  legacyLiteralClientCredentials,
  legacyEnvRefClientCredentials,
]);

const clientIdOnlyCredentialsSchema = z.object({
  clientId: credentialFieldSchema,
});

const legacyLiteralClientIdOnly = z
  .object({ clientId: z.string().min(1) })
  .transform((c) => ({
    clientId: { type: "literal" as const, value: c.clientId },
  }));

const legacyEnvRefClientIdOnly = z
  .object({ clientIdEnv: z.string().min(1) })
  .transform((c) => ({
    clientId: { type: "envRef" as const, envName: c.clientIdEnv },
  }));

const effectiveClientIdOnlyCredentialsSchema = z.union([
  clientIdOnlyCredentialsSchema,
  legacyLiteralClientIdOnly,
  legacyEnvRefClientIdOnly,
]);

// Client credentials flow (traditional OAuth with client secret)
const clientCredentialsProviderSchema = z.object({
  authMethod: z.literal("client_credentials"),
  credentials: effectiveClientCredentialsSchema,
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
  credentials: effectiveClientIdOnlyCredentialsSchema,
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
export type CredentialField = z.infer<typeof credentialFieldSchema>;

export const appConfigSchema = z.object({
  permissions: permissionsSchema,
  toolGroups: toolGroupSchema,
  auth: authSchema,
  toolExtensions: toolExtensionsSchema,
  targetServerAttributes: targetServerAttributesSchema,
  staticOauth: staticOAuthSchema,
  skills: skillsConfigSchema,
});

export type AppConfig = z.infer<typeof appConfigSchema>;
