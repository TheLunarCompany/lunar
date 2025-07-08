import "dotenv/config";
import { z } from "zod/v4";

const envSchema = z.object({
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .default("info"),
  MCPX_SERVER_URL: z.string().default("http://localhost:9000"),
  PORT: z.coerce.number().default(9001),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
