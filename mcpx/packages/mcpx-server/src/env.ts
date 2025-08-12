import { createEnv } from "@mcpx/toolkit-core/config";
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
  HUB_WS_URL: z.string().default("ws://127.0.0.1:3030"),
  ENABLE_METRICS: z.stringbool().default(true),
  SERVE_METRICS_PORT: z.coerce.number().default(3000),
  UI_PORT: z.coerce.number().optional(),
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
  LOKI_USER: z.string().default(""),
  LOKI_PASSWORD: z.string().default(""),
  VERSION: z.string(),
  INSTANCE_ID: z.string(),
  LUNAR_TELEMETRY: z.stringbool().default(true),
  LUNAR_API_KEY: z.string().default(""),
  AUDIT_LOG_FLUSH_INTERVAL_IN_SEC: z.coerce.number().default(5),
  AUDIT_LOG_DIR: z.string().default(path.join(process.cwd(), "audit-logs")),
  AUDIT_LOG_RETENTION_HOURS: z.coerce.number().default(336),
  ENABLE_AUDIT_LOG: z.stringbool().default(true),
});

const NON_SECRET_KEYS = [
  "LOG_LEVEL",
  "MCPX_PORT",
  "ENABLE_CONTROL_PLANE_STREAMING",
  "ENABLE_CONTROL_PLANE_REST",
  "WEBSERVER_URL",
  "WEBSERVER_WS_URL",
  "HUB_WS_URL",
  "DIND_ENABLED",
  "INTERCEPTION_ENABLED",
  "ENABLE_METRICS",
  "SERVE_METRICS_PORT",
  "UI_PORT",
  "APP_CONFIG_PATH",
  "SERVERS_CONFIG_PATH",
  "READ_TARGET_SERVERS_FROM_FILE",
  "OAUTH_TIMEOUT_SECONDS",
  "CONTROL_PLANE_APP_CONFIG_USE_NEXT_VERSION",
  "CONTROL_PLANE_APP_CONFIG_KEEP_DISCRIMINATING_TAGS",
  "VERSION",
  "INSTANCE_ID",
  "LUNAR_TELEMETRY",
  "AUDIT_LOG_FLUSH_INTERVAL_IN_SEC",
  "AUDIT_LOG_DIR",
  "AUDIT_LOG_RETENTION_HOURS",
  "ENABLE_AUDIT_LOG",
] as const;

export const { env, getEnv, resetEnv, redactEnv } = createEnv(
  envSchema,
  NON_SECRET_KEYS,
);
