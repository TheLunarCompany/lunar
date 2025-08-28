import "dotenv/config";
import { z } from "zod/v4";

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
  MCPX_SERVER_URL: z.string().default("http://127.0.0.1:9000"),
  WEBSERVER_URL: z.string().default("http://127.0.0.1:9001"),
  WEBSERVER_PORT: z.coerce.number().default(9001),
  MCPX_PORT: z.coerce.number().default(9000),
  UI_PORT: z.coerce.number().default(5173),
  LOKI_HOST: z.string().default("log-collector-dev.lunar.dev"),
  LOKI_USER: z.string().default(""),
  LOKI_PASSWORD: z.string().default(""),
  VERSION: z.string(),
  INSTANCE_ID: z.string(),
  LUNAR_TELEMETRY: z.stringbool().default(true),
  LUNAR_API_KEY: z.string().default(""),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
