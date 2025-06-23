import "dotenv/config";
import { z } from "zod/v4";

const envSchema = z.object({
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .default("info"),
  AUTH_KEY: z.string().optional(),
  PORT: z.coerce.number().default(9000),
  ENABLE_CONTROL_PLANE_STREAMING: z.stringbool().default(true),
  ENABLE_CONTROL_PLANE_REST: z.stringbool().default(false),
  CONTROL_PLANE_HOST: z.string().default("http://localhost:9001"),
  DIND_ENABLED: z.stringbool().default(false),
  ENABLE_METRICS: z.stringbool().default(true),
  SERVE_METRICS_PORT: z.coerce.number().default(3000),
  APP_CONFIG_PATH: z.string().default("config/app.yaml"),
  SERVERS_CONFIG_PATH: z.string().default("config/mcp.json"),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
