import "dotenv/config";
import { z } from "zod/v4";

const envSchema = z.object({
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .default("info"),
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
  LUNAR_TELEMETRY: z
    .string()
    .transform((val: string) => val === 'true')
    .default("true"),
  LUNAR_API_KEY: z.string().default(""),
  PUBLIC_HOST: z.string().default("127.0.0.1"),
  PUBLIC_HOST_SUPPORT_TLS: z
    .string()
    .transform((val: string) => val === 'true')
    .default("false"),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
