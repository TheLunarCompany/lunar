import { z } from "zod/v4";

export const deleteSavedSetupPayloadSchema = z.object({
  savedSetupId: z.string().uuid(),
});
