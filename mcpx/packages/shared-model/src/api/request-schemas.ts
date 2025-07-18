import YAML from "yaml";
import { z } from "zod/v4";

// ZOD
export const createTargetServerStdioRequestSchema = z
  .object({
    type: z.literal("stdio").default("stdio"),
    args: z.string().transform((value) =>
      value
        .split(" ")
        .map((arg) => arg.trim())
        .filter(Boolean)
    ),
    command: z.string(),
    env: z
      .string()
      .optional()
      .transform((value) => (value?.trim() ? JSON.parse(value) : {})),
    icon: z.string().optional(),
    name: z.string(),
  })
  .strict();

export const createTargetServerSSESchema = z.object({
  type: z.literal("sse"),
  url: z.string(),
  icon: z.string().optional(),
  name: z.string(),
});

export const createTargetServerStreamableHttpSchema = z.object({
  type: z.literal("streamable-http"),
  url: z.string(),
  icon: z.string().optional(),
  name: z.string(),
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

export const updateTargetServerRequestSchema =
  createTargetServerStdioRequestSchema.omit({ name: true });

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
  z.unknown()
);

// TS
export interface RawCreateTargetServerRequest {
  args: string;
  command: string;
  env?: string;
  icon: string;
  name: string;
}

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

export interface CreateTargetServerRequest {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export type UpdateTargetServerRequest = Omit<CreateTargetServerRequest, "name">;

export type ApplyParsedAppConfigRequest = z.infer<
  typeof applyParsedAppConfigRequestSchema
>;
