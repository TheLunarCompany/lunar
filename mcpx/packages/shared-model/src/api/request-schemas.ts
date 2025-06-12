import { z } from "zod/v4";

// ZOD
export const createTargetServerRequestSchema = z
  .object({
    name: z.string(),
    command: z.string(),
    args: z.array(z.string()),
    env: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export const updateTargetServerRequestSchema =
  createTargetServerRequestSchema.omit({ name: true });

export const applyRawAppConfigRequestSchema = z.object({ yaml: z.string() });

// TS
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
