import "dotenv/config";
import { z } from "zod/v4";

const envSchema = z.object({
  PORT: z.coerce.number().default(9001),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
