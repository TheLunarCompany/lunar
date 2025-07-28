import "dotenv/config";
import { z } from "zod/v4";

const envSchema = z.object({
  LOKI_HOST: z.string().default("log-collector-dev.lunar.dev"),
  VERSION: z.string().default("0.0.0"),
  INSTANCE_ID: z.string().default("unknown"),
  LUNAR_TELEMETRY: z.stringbool().default(true),
  LUNAR_API_KEY: z.string().default(""),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
