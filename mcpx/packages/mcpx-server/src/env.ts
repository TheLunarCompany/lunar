import "dotenv/config";
import { z } from "zod/v4";

const envSchema = z.object({
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .default("info"),
  AUTH_KEY: z.string().optional(),
  PORT: z.coerce.number().default(9000),
  ENABLE_HUB: z.stringbool().default(true),
  DIND_ENABLED: z.stringbool().default(false),
  HUB_HOST: z.string().default("http://localhost:9001"),
  ENABLE_METRICS: z.stringbool().default(true),
  SERVE_METRICS_PORT: z.coerce.number().default(3000),
  APP_CONFIG_PATH: z.string().default("config/app.yaml"),
  SERVERS_CONFIG_PATH: z.string().default("config/mcp.json"),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
