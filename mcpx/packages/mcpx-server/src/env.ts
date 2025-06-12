import "dotenv/config";
import { z } from "zod/v4";

const envSchema = z.object({
  LUNAR_API_KEY: z.string().optional(),
  PORT: z.coerce.number().default(9000),
  ENABLE_HUB: z.coerce.boolean().default(false),
  HUB_HOST: z.string().default("http://localhost:9001"),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
