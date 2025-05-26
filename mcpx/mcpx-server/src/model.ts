import { z } from "zod";

export interface TargetServersConfig {
  servers: Record<string, RawServerData>;
}

interface RawServerData {
  address: string;
}

export const targetServerSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
});
export const targetServerConfigSchema = z.object({
  mcpServers: z.record(targetServerSchema),
});

export type TargetServerConfig = z.infer<typeof targetServerSchema>;
export type TargetServer = TargetServerConfig & { name: string };

export type Tool = {
  name: string;
  inputSchema: {
    type: "object";
    properties?: unknown;
  } & { [k: string]: unknown };
  description?: string | undefined;
};

export const messageSchema = z.object({
  method: z.string(),
  params: z
    .object({
      name: z.string().optional(),
      arguments: z.record(z.string(), z.any()).optional(),
    })
    .optional(),
});
