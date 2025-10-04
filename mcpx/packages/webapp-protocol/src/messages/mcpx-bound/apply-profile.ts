import z from "zod/v4";

export const applyProfilePayloadSchema = z.object({
  setup: z.string(),
});
