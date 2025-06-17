import { z } from "zod/v4";

// ZOD
export const createTargetServerRequestSchema = z
  .object({
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

export const updateTargetServerRequestSchema =
  createTargetServerRequestSchema.omit({ name: true });

export const applyRawAppConfigRequestSchema = z.object({ yaml: z.string() });

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

export type ApplyRawAppConfigRequest = z.infer<
  typeof applyRawAppConfigRequestSchema
>;

export interface ApplyParsedAppConfigRequest {
  obj: object;
}
