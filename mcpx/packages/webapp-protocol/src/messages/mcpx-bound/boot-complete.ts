import { z } from "zod/v4";

// Emitted once, after the last boot-handshake event. Marks the end of the
// connection-time hydration cycle; carries no data.
export const bootCompletePayloadSchema = z.object({});
export type BootCompletePayload = z.output<typeof bootCompletePayloadSchema>;
