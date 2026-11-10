import z from "zod/v4";

export const ackSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), failureMessage: z.string().optional() }),
]);

export type Ack = z.infer<typeof ackSchema>;

// conflict: the resource moved since the caller read it (e.g. a skill's updatedAt
// is past the draft save's baseUpdatedAt).
export const webappBoundErrorCodeSchema = z.enum([
  "not_found",
  "conflict",
  "internal_error",
]);
export type WebappBoundErrorCode = z.infer<typeof webappBoundErrorCodeSchema>;

export const webappBoundFailureAckSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  errorCode: webappBoundErrorCodeSchema.optional(),
});
export type WebappBoundFailureAck = z.infer<typeof webappBoundFailureAckSchema>;

type WebappBoundSuccessAckSchema<Success extends z.ZodRawShape> = z.ZodObject<
  { success: z.ZodLiteral<true> } & Success
>;
type WebappBoundAckSchema<Success extends z.ZodRawShape> =
  z.ZodDiscriminatedUnion<
    [WebappBoundSuccessAckSchema<Success>, typeof webappBoundFailureAckSchema]
  >;

// The ack of every request the mcpx sends to the webapp side: the event's own
// success fields, or the one failure shape.
export function webappBoundAckSchema<Success extends z.ZodRawShape>(
  successShape: Success,
): WebappBoundAckSchema<Success> {
  return z.discriminatedUnion("success", [
    z.object({ success: z.literal(true), ...successShape }),
    webappBoundFailureAckSchema,
  ]);
}
