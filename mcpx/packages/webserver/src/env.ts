import "dotenv/config";
import { z } from "zod/v4";

const envSchema = z.object({
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .default("info"),
  PORT: z.coerce.number().default(9001),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
