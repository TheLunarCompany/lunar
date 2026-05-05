import YAML from "yaml";
import { z } from "zod/v4";

// ZOD
export const envValueSchema = z.union([
  z.string(),
  z.object({ fromEnv: z.string() }),
  z.object({ fromSecret: z.string() }),
  z.null(),
]);

// "Empty" prefilled — "", { fromEnv: "" }, { fromSecret: "" }, null — carries no info
// and is normalized to "no prefill" for required/optional kinds; left untouched for fixed.
export function isEmptyPrefilled(
  value: z.infer<typeof envValueSchema> | undefined,
): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value === "";
  if ("fromEnv" in value) return value.fromEnv === "";
  if ("fromSecret" in value) return value.fromSecret === "";
  return false;
}

// Env requirement types (what admin defines, UI displays)
// - required: user must provide (can have prefilled default)
// - optional: user can skip (can have prefilled default)
// - fixed: not editable by user (always has prefilled value)
const envRequirementBaseSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("required"),
    prefilled: envValueSchema.optional(),
    description: z.string().optional(),
    isSecret: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal("optional"),
    prefilled: envValueSchema.optional(),
    description: z.string().optional(),
    isSecret: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal("fixed"),
    prefilled: envValueSchema,
    description: z.string().optional(),
    isSecret: z.boolean().default(false),
  }),
]);

// Empty prefilled ("", { fromEnv: "" }, { fromSecret: "" }, null) becomes undefined
// for required/optional, so the AdminUI doesn't see a hollow default and downstream
// consumers don't treat it as a real value (e.g. mcpx's secret-prefill protection).
//
// Fixed is intentionally left untouched:
//   - Failing the parse would 500 every catalog response if any legacy row in the wild
//     has fixed-with-empty (parse runs on every read, not just on writes).
//   - Dropping the prefilled like we do for required/optional would break the discriminator
//     contract: fixed REQUIRES prefilled. The runtime then has no value to inject and
//     fails opaquely on connect, far from the cause.
//   - In practice AdminUI's `isAdminValueValid` already blocks fixed-with-empty on save,
//     so legacy rows shouldn't exist. If one does, the runtime will fail at server-connect
//     time, which is louder and easier to diagnose than a silent transform.
export const envRequirementSchema = envRequirementBaseSchema.transform(
  (req) => {
    if (req.kind === "fixed") return req;
    if (isEmptyPrefilled(req.prefilled)) {
      return { ...req, prefilled: undefined };
    }
    return req;
  },
);

export const envRequirementsSchema = z.record(z.string(), envRequirementSchema);

export const AllowedCommands = z.enum(["npx", "uvx", "docker", "node"]);

export const secretKeysSchema = z.array(z.string());
export type SecretKeys = z.infer<typeof secretKeysSchema>;

export const createTargetServerStdioRequestSchema = z
  .object({
    type: z.literal("stdio").default("stdio"),
    args: z.array(z.string()).default([]),
    command: AllowedCommands,
    env: z.record(z.string(), envValueSchema).optional().default({}),
    icon: z.string().optional(),
    name: z.string(),
    catalogItemId: z.string().optional(),
  })
  .strict();

export const createTargetServerSSESchema = z.object({
  type: z.literal("sse"),
  url: z.string(),
  headers: z.record(z.string(), envValueSchema).optional(),
  icon: z.string().optional(),
  name: z.string(),
  catalogItemId: z.string().optional(),
});

export const createTargetServerStreamableHttpSchema = z.object({
  type: z.literal("streamable-http"),
  url: z.string(),
  headers: z.record(z.string(), envValueSchema).optional(),
  icon: z.string().optional(),
  name: z.string(),
  catalogItemId: z.string().optional(),
});

export const createTargetServerRequestSchema = z.union([
  createTargetServerStdioRequestSchema,
  createTargetServerSSESchema,
  createTargetServerStreamableHttpSchema,
]);
export const updateTargetServerStdioRequestSchema =
  createTargetServerStdioRequestSchema.omit({
    name: true,
  });

export const updateTargetServerSSESchema = createTargetServerSSESchema.omit({
  name: true,
});

export const updateTargetServerStreamableHttpSchema =
  createTargetServerStreamableHttpSchema.omit({
    name: true,
  });

export const updateTargetServerRequestSchema = z.union([
  updateTargetServerStdioRequestSchema,
  updateTargetServerSSESchema,
  updateTargetServerStreamableHttpSchema,
]);

export const applyRawAppConfigRequestSchema = z.strictObject({
  yaml: z.string().transform((val, ctx) => {
    try {
      const parsed = YAML.parse(val);
      return parsed;
    } catch (e) {
      ctx.issues.push({
        code: "custom",
        message: e instanceof Error ? e.message : "Not a valid YAML format",
        input: val,
      });

      // this is a special constant with type `never`
      // returning it lets you exit the transform without impacting the inferred return type
      return z.NEVER;
    }
  }),
});

export const applyParsedAppConfigRequestSchema = z.record(
  z.string(),
  z.unknown(),
);

export const initiateServerAuthRequestSchema = z.object({
  callbackUrl: z.url().optional(),
});

export const saveSetupRequestSchema = z.object({
  description: z.string().min(1),
});

// Create server from catalog item
// ID comes from URL path, type is inferred from catalog item
export const createServerFromCatalogRequestSchema = z.object({
  envValues: z.record(z.string(), envValueSchema).optional(),
});

// TS
export type RawCreateTargetServerRequest = z.input<
  typeof createTargetServerRequestSchema
>;

export type RawUpdateTargetServerRequest = Omit<
  RawCreateTargetServerRequest,
  "name"
>;

export type TargetServerRequest = z.infer<
  typeof createTargetServerRequestSchema
>;

export interface TargetServerName {
  name: string;
}
export interface SerializedAppConfig {
  yaml: string;
  version: number;
  lastModified: Date;
}

export type UpdateTargetServerRequest = z.infer<
  typeof updateTargetServerRequestSchema
>;

export type ApplyParsedAppConfigRequest = z.infer<
  typeof applyParsedAppConfigRequestSchema
>;

export type EnvRequirement = z.infer<typeof envRequirementSchema>;
export type EnvRequirements = z.infer<typeof envRequirementsSchema>;
export type CreateServerFromCatalogRequest = z.infer<
  typeof createServerFromCatalogRequestSchema
>;

export type InitiateServerAuthResult =
  | {
      status: 200;
      data: {
        authorizationUrl: null;
        userCode: null;
        msg: string;
        targetServerName: string;
      };
    }
  | {
      status: 202;
      data: {
        authorizationUrl: string;
        userCode: string | null;
        msg: string;
        targetServerName: string;
      };
    };

// Dynamic capabilities
export const dynamicCapabilitiesStatusResponseSchema = z.object({
  consumerTag: z.string(),
  enabled: z.boolean(),
});

export type DynamicCapabilitiesStatusResponse = z.infer<
  typeof dynamicCapabilitiesStatusResponseSchema
>;
