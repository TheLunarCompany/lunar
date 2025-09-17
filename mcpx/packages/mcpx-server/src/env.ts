import { createEnv } from "@mcpx/toolkit-core/config";
import "dotenv/config";
import path from "path";
import { z } from "zod/v4";

const parseToArray = (s: string): string[] => {
  const trimmed = s.trim();
  if (!trimmed) return [];
  return trimmed.split(/[,\s]+/).filter(Boolean);
};

const commaSeparatedStringArraySchema = z
  .string()
  .optional()
  .transform((val) => (val === undefined ? undefined : parseToArray(val)))
  .refine(
    (arr) => arr === undefined || arr.every((v) => typeof v === "string"),
    "Values must be strings",
  );

const logLevelSchema = z.enum([
  "error",
  "warn",
  "info",
  "http",
  "verbose",
  "debug",
  "silly",
]);
const envSchema = z.object({
  LOG_LEVEL: logLevelSchema.default("info"),
  ACCESS_LOG_LEVEL: logLevelSchema.default("debug"),
  AUTH_KEY: z.string().optional(),
  MCPX_PORT: z.coerce.number().default(9000),
  PING_INTERVAL_MS: z.coerce.number().default(5000),
  MAX_MISSED_PINGS: z.coerce.number().default(3),
  PROBE_CLIENTS_GRACE_LIVENESS_PERIOD_MS: z.coerce.number().default(10000),
  ENABLE_CONTROL_PLANE_STREAMING: z.stringbool().default(true),
  ENABLE_CONTROL_PLANE_REST: z.stringbool().default(true),
  HUB_WS_URL: z.string().default("ws://127.0.0.1:3030"),
  ENABLE_METRICS: z.stringbool().default(true),
  SERVE_METRICS_PORT: z.coerce.number().default(3000),
  UI_PORT: z.coerce.number().optional(),
  APP_CONFIG_PATH: z.string().default("config/app.yaml"),
  SERVERS_CONFIG_PATH: z.string().default("config/mcp.json"),
  READ_TARGET_SERVERS_FROM_FILE: z.stringbool().default(true),
  OAUTH_TIMEOUT_SECONDS: z.coerce.number().default(60),
  OAUTH_DISCOVERY_TIMEOUT_MILLIS: z.coerce.number().default(3000),
  AUTH_TOKENS_DIR: z
    .string()
    .default(path.join(process.cwd(), ".mcpx", "tokens")),
  DIND_ENABLED: z.stringbool().default(true),
  INTERCEPTION_ENABLED: z.stringbool().default(true),
  MITM_PROXY_CA_CERT_PATH: z.string().default(""),
  CONTROL_PLANE_APP_CONFIG_USE_NEXT_VERSION: z.stringbool().default(true),
  CONTROL_PLANE_APP_CONFIG_KEEP_DISCRIMINATING_TAGS: z
    .stringbool()
    .default(true),
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
  ALLOWED_IP_RANGES: commaSeparatedStringArraySchema,
  CORS_ORIGINS: commaSeparatedStringArraySchema.default([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]),
  OAUTH_CALLBACK_BASE_URL: z.string().optional(),
});

const NON_SECRET_KEYS = [
  "LOG_LEVEL",
  "ACCESS_LOG_LEVEL",
  "MCPX_PORT",
  "PING_INTERVAL_MS",
  "MAX_MISSED_PINGS",
  "PROBE_CLIENTS_GRACE_LIVENESS_PERIOD_MS",
  "ENABLE_CONTROL_PLANE_STREAMING",
  "ENABLE_CONTROL_PLANE_REST",
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
  "OAUTH_DISCOVERY_TIMEOUT_MILLIS",
  "CONTROL_PLANE_APP_CONFIG_USE_NEXT_VERSION",
  "CONTROL_PLANE_APP_CONFIG_KEEP_DISCRIMINATING_TAGS",
  "VERSION",
  "INSTANCE_ID",
  "LUNAR_TELEMETRY",
  "AUDIT_LOG_FLUSH_INTERVAL_IN_SEC",
  "AUDIT_LOG_DIR",
  "AUDIT_LOG_RETENTION_HOURS",
  "ENABLE_AUDIT_LOG",
  "ALLOWED_IP_RANGES",
  "CORS_ORIGINS",
  "OAUTH_CALLBACK_BASE_URL",
] as const;

export const { env, getEnv, resetEnv, redactEnv } = createEnv(
  envSchema,
  NON_SECRET_KEYS,
);
