import z from "zod/v4";

export const ackSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), failureMessage: z.string().optional() }),
]);

export type Ack = z.infer<typeof ackSchema>;
