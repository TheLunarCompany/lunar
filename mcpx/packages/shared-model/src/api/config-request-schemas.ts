import { z } from "zod/v4";
import { singleToolGroupSchema } from "../config/config.js";

export const toolGroupUpdateSchema = singleToolGroupSchema
  .omit({ name: true })
  .extend({ name: z.string().optional() });

export type ToolGroupUpdate = z.infer<typeof toolGroupUpdateSchema>;
