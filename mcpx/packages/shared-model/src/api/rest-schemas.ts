import { z } from "zod/v4";

export interface CreateTargetServerRequest {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export type UpdateTargetServerRequest = Omit<CreateTargetServerRequest, "name">;

export interface GetAppConfigResponse {
  yaml: string;
  version: number;
  lastModified: Date;
}

export interface ApplyAppConfigRequest {
  yaml: string;
}

// ZOD Schemas
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

export const applyAppConfigRequestSchema = z.object({ yaml: z.string() });
