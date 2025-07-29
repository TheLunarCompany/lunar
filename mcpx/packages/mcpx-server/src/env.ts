import "dotenv/config";
import path from "path";
import { z } from "zod/v4";

const envSchema = z.object({
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .default("info"),
  AUTH_KEY: z.string().optional(),
  MCPX_PORT: z.coerce.number().default(9000),
  ENABLE_CONTROL_PLANE_STREAMING: z.stringbool().default(true),
  ENABLE_CONTROL_PLANE_REST: z.stringbool().default(true),
  WEBSERVER_URL: z.string().default("http://127.0.0.1:9001"),
  WEBSERVER_WS_URL: z.string().default("ws://127.0.0.1:9001"),
  ENABLE_METRICS: z.stringbool().default(true),
  SERVE_METRICS_PORT: z.coerce.number().default(3000),
  APP_CONFIG_PATH: z.string().default("config/app.yaml"),
  SERVERS_CONFIG_PATH: z.string().default("config/mcp.json"),
  READ_TARGET_SERVERS_FROM_FILE: z.stringbool().default(true),
  OAUTH_TIMEOUT_SECONDS: z.coerce.number().default(60),
  AUTH_TOKENS_DIR: z
    .string()
    .default(path.join(process.cwd(), ".mcpx", "tokens")),
  DIND_ENABLED: z.stringbool().default(true),
  INTERCEPTION_ENABLED: z.stringbool().default(true),
  MITM_PROXY_CA_CERT_PATH: z.string().default(""),
  CONTROL_PLANE_APP_CONFIG_USE_NEXT_VERSION: z.stringbool().default(false),
  CONTROL_PLANE_APP_CONFIG_KEEP_DISCRIMINATING_TAGS: z
    .stringbool()
    .default(false),
  LOKI_HOST: z.string().default("log-collector-dev.lunar.dev"),
  VERSION: z.string(),
  INSTANCE_ID: z.string(),
  LUNAR_TELEMETRY: z.stringbool().default(true),
  LUNAR_API_KEY: z.string().default(""),
});

export type Env = z.infer<typeof envSchema>;

export const NON_SECRET_KEYS = [
  "LOG_LEVEL",
  "MCPX_PORT",
  "ENABLE_CONTROL_PLANE_STREAMING",
  "ENABLE_CONTROL_PLANE_REST",
  "WEBSERVER_URL",
  "WEBSERVER_WS_URL",
  "DIND_ENABLED",
  "INTERCEPTION_ENABLED",
  "ENABLE_METRICS",
  "SERVE_METRICS_PORT",
  "APP_CONFIG_PATH",
  "SERVERS_CONFIG_PATH",
  "READ_TARGET_SERVERS_FROM_FILE",
  "OAUTH_TIMEOUT_SECONDS",
  "CONTROL_PLANE_APP_CONFIG_USE_NEXT_VERSION",
  "CONTROL_PLANE_APP_CONFIG_KEEP_DISCRIMINATING_TAGS",
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

let cachedEnv: Env | undefined;

/** Parse process.env or a supplied bag, cache the result, return it. */
export function getEnv(vars: NodeJS.ProcessEnv = process.env): Env {
  if (!cachedEnv) cachedEnv = envSchema.parse(vars);
  return cachedEnv;
}

/** Flush the cache so the next call to getEnv re‑parses. */
export function resetEnv(vars: NodeJS.ProcessEnv = process.env): void {
  cachedEnv = envSchema.parse(vars);
}

/** Convenience proxy so existing `env.X` code still works. */
export const env: Env = new Proxy({} as Env, {
  get(_, prop: keyof Env): unknown {
    return (getEnv() as Env)[prop];
  },
  ownKeys(): (string | symbol)[] {
    return Reflect.ownKeys(getEnv());
  },
  getOwnPropertyDescriptor(_, prop: string): PropertyDescriptor | undefined {
    return Object.getOwnPropertyDescriptor(getEnv(), prop);
  },
});
