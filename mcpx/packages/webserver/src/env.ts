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
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
