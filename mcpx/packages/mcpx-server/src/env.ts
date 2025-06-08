import "dotenv/config";
import { z } from "zod/v4";

const envSchema = z.object({
  API_KEY: z.string().optional(),
  PORT: z.coerce.number().default(9000),
  WEBSERVER_PORT: z.coerce.number().default(9001),
  ENABLE_WEBSERVER: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
