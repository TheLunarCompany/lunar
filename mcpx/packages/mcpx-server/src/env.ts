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
  INTERCEPTION_ENABLED: z.stringbool().default(false),
  ENABLE_METRICS: z.stringbool().default(true),
  SERVE_METRICS_PORT: z.coerce.number().default(3000),
  APP_CONFIG_PATH: z.string().default("config/app.yaml"),
  SERVERS_CONFIG_PATH: z.string().default("config/mcp.json"),
  READ_TARGET_SERVERS_FROM_FILE: z.stringbool().default(true),
  MITM_PROXY_CA_CERT_PATH: z.string().default(""),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);

export const NON_SECRET_KEYS = [
  "LOG_LEVEL",
  "PORT",
  "ENABLE_CONTROL_PLANE_STREAMING",
  "ENABLE_CONTROL_PLANE_REST",
  "CONTROL_PLANE_HOST",
  "DIND_ENABLED",
  "INTERCEPTION_ENABLED",
  "ENABLE_METRICS",
  "SERVE_METRICS_PORT",
  "APP_CONFIG_PATH",
  "SERVERS_CONFIG_PATH",
  "READ_TARGET_SERVERS_FROM_FILE",
] as const;

export function redactEnv<T extends Record<string, unknown>>(
  obj: T,
  nonSecretKeys: readonly (keyof T)[],
): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      nonSecretKeys.includes(k as keyof T) ? [k, v] : [k, "***REDACTED***"],
    ),
  ) as T;
}
