import { createEnv } from "@mcpx/toolkit-core/config";
import "dotenv/config";
import path from "path";
import { z } from "zod/v4";

/*
 * Enum of allowed tags for log hiding
 * Users can specify these tags in the LOG_HIDE_TAGS env variable to hide specific logs
 * However the usage of these tags is determined by the application logic.
 * NOTE: Candidate should be chosen carefully to avoid accidental hiding of important logs.
 * Generally, these should be repetitive logs that can clutter log files.
 * They are probably already in debug level, if not, that is a flag.
 */
export enum AllowedLogHideTagsEnum {
  CLIENT_ACCESS_LOG = "client-access-log",
  AUDIT_LOG_PERSISTENCE = "audit-log-persistence",
  DETAILED_TOOL_LISTINGS = "detailed-tool-listings",
}

// Based on Tiktoken's supported encodings
export enum TokenizerEncoding {
  CL100K_BASE = "cl100k_base",
  O200K_BASE = "o200k_base",
  P50K_BASE = "p50k_base",
  P50K_EDIT = "p50k_edit",
  R50K_BASE = "r50k_base",
}
export const DEFAULT_TOKENIZER_ENCODING = TokenizerEncoding.CL100K_BASE;

/*
 * == HELPER FUNCTIONS ==
 */
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

/*
 * == ENV SCHEMA DEFINITION ===
 */
const envSchema = z
  .object({
    LOG_LEVEL: logLevelSchema.default("info"),
    ACCESS_LOG_LEVEL: logLevelSchema.default("debug"),
    LOG_HIDE_TAGS: commaSeparatedStringArraySchema.transform((array) =>
      z.array(z.enum(AllowedLogHideTagsEnum)).parse(array || []),
    ),
    AUTH_KEY: z.string().optional(),
    MCPX_PORT: z.coerce.number().default(9000),
    PING_INTERVAL_MS: z.coerce.number().default(5000),
    DOWNSTREAM_KEEPALIVE_INTERVAL_MS: z.coerce.number().default(25000),
    TOOL_CALL_CACHE_TTL_MS: z.coerce.number().default(5 * 60_000),
    TOOL_CALL_CACHE_MAX_ENTRIES: z.coerce.number().default(1000),
    STREAMABLE_EVENT_STORE_MAX_EVENT_AGE_MS: z.coerce
      .number()
      .default(5 * 60_000),
    PROBE_CLIENTS_GRACE_LIVENESS_PERIOD_MS: z.coerce.number().default(10000),
    AGENT_SESSION_TTL_MIN: z.coerce.number().default(1440),
    KEEPALIVE_SWEEP_INTERVAL_MIN: z.coerce.number().optional(),
    ENABLE_CONTROL_PLANE_STREAMING: z.stringbool().default(true),
    ENABLE_CONTROL_PLANE_REST: z.stringbool().default(true),
    HUB_WS_URL: z.string().default("ws://127.0.0.1:3030"),
    ENABLE_METRICS: z.stringbool().default(true),
    SERVE_METRICS_PORT: z.coerce.number().default(3000),
    UI_PORT: z.coerce.number().optional().default(5173),
    UI_URL: z.string().optional().default("http://127.0.0.1:5173"),
    APP_CONFIG_PATH: z.string().default("config/app.yaml"),
    SERVERS_CONFIG_PATH: z.string().default("config/mcp.json"),
    READ_TARGET_SERVERS_FROM_FILE: z.stringbool().default(true),
    OAUTH_DISCOVERY_TIMEOUT_MILLIS: z.coerce.number().default(3000),
    AUTH_TOKENS_DIR: z
      .string()
      .default(path.join(process.cwd(), ".mcpx", "tokens")),
    DIND_ENABLED: z.stringbool().default(true),
    INTERCEPTION_ENABLED: z.stringbool().default(true),
    MITM_PROXY_CA_CERT_PATH: z.string().default(""),
    LOKI_HOST: z.string().default("log-collector-dev.lunar.dev"),
    LOKI_USER: z.string().default(""),
    LOKI_PASSWORD: z.string().default(""),
    VERSION: z.string(),
    INSTANCE_ID: z.string(),
    INSTANCE_KEY: z.string().optional(), // In enterprise mode, this would be filled in with external user id (sub)
    INSTANCE_NAME: z.string().optional(), // In enterprise mode, this would be filled in with the user's full name
    LUNAR_TELEMETRY: z.stringbool().default(true),
    LUNAR_API_KEY: z.string().default(""),
    AUDIT_LOG_FLUSH_INTERVAL_IN_SEC: z.coerce.number().default(5),
    AUDIT_LOG_DIR: z.string().default(path.join(process.cwd(), "audit-logs")),
    AUDIT_LOG_RETENTION_HOURS: z.coerce.number().default(336),
    ENABLE_AUDIT_LOG: z.stringbool().default(true),
    ALLOWED_IP_RANGES: commaSeparatedStringArraySchema,
    CORS_ORIGINS: commaSeparatedStringArraySchema.optional(),
    OAUTH_CALLBACK_BASE_URL: z.string().optional(),
    ENFORCE_HUB_CONNECTION: z.stringbool().default(false),
    USAGE_STATS_INTERVAL_MS: z.coerce.number().default(60000),
    CONNECTION_TIMEOUT_MS: z.coerce.number().default(180000),
    STDIO_INHERIT_PROCESS_ENV: z.stringbool().default(false),
    TOKENIZER_ENCODING: z
      .enum(TokenizerEncoding)
      .default(DEFAULT_TOKENIZER_ENCODING),
    ENABLE_PROMPT_CAPABILITY: z.stringbool().default(false),
    STRICTNESS_REQUIRED: z.stringbool().default(false),
  })
  // Add synthetic env variables:
  .transform((parsed) => ({
    ...parsed,
    IS_ENTERPRISE: !!parsed.INSTANCE_KEY,
  }));

const NON_SECRET_KEYS = [
  "LOG_LEVEL",
  "ACCESS_LOG_LEVEL",
  "LOG_HIDE_TAGS",
  "MCPX_PORT",
  "PING_INTERVAL_MS",
  "DOWNSTREAM_KEEPALIVE_INTERVAL_MS",
  "TOOL_CALL_CACHE_TTL_MS",
  "TOOL_CALL_CACHE_MAX_ENTRIES",
  "STREAMABLE_EVENT_STORE_MAX_EVENT_AGE_MS",
  "PROBE_CLIENTS_GRACE_LIVENESS_PERIOD_MS",
  "AGENT_SESSION_TTL_MIN",
  "KEEPALIVE_SWEEP_INTERVAL_MIN",
  "ENABLE_CONTROL_PLANE_STREAMING",
  "ENABLE_CONTROL_PLANE_REST",
  "HUB_WS_URL",
  "DIND_ENABLED",
  "INTERCEPTION_ENABLED",
  "ENABLE_METRICS",
  "SERVE_METRICS_PORT",
  "UI_PORT",
  "UI_URL",
  "APP_CONFIG_PATH",
  "SERVERS_CONFIG_PATH",
  "READ_TARGET_SERVERS_FROM_FILE",
  "OAUTH_DISCOVERY_TIMEOUT_MILLIS",
  "VERSION",
  "INSTANCE_ID",
  "INSTANCE_KEY",
  "INSTANCE_NAME",
  "LUNAR_TELEMETRY",
  "AUDIT_LOG_FLUSH_INTERVAL_IN_SEC",
  "AUDIT_LOG_DIR",
  "AUDIT_LOG_RETENTION_HOURS",
  "ENABLE_AUDIT_LOG",
  "ALLOWED_IP_RANGES",
  "CORS_ORIGINS",
  "OAUTH_CALLBACK_BASE_URL",
  "ENFORCE_HUB_CONNECTION",
  "USAGE_STATS_INTERVAL_MS",
  "CONNECTION_TIMEOUT_MS",
  "STDIO_INHERIT_PROCESS_ENV",
  "TOKENIZER_ENCODING",
  "ENABLE_PROMPT_CAPABILITY",
  "IS_ENTERPRISE",
  "STRICTNESS_REQUIRED",
] as const;

export const { env, getEnv, resetEnv, redactEnv } = createEnv(
  envSchema,
  NON_SECRET_KEYS,
);
