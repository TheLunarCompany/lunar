import { z } from "zod/v4";

// ============================================================================
// Dynamic Capabilities Matching Schemas
// ============================================================================

export const dynamicCapabilitiesMatchingPayloadSchema = z.object({
  systemPrompt: z.string(),
  userMessage: z.string(),
});

export const dynamicCapabilitiesMatchingResponseSchema = z.object({
  tools: z.array(
    z.object({
      serverName: z.string(),
      toolName: z.string(),
    }),
  ),
});

// ============================================================================
// Ack Schema Builder
// ============================================================================

function buildAckSchema<T extends z.ZodSchema>(
  resultSchema: T,
): z.ZodDiscriminatedUnion<
  [
    z.ZodObject<{ status: z.ZodLiteral<"success">; result: T }>,
    z.ZodObject<{ status: z.ZodLiteral<"error">; error: z.ZodString }>,
    z.ZodObject<{ status: z.ZodLiteral<"unsupported"> }>,
  ]
> {
  return z.discriminatedUnion("status", [
    z.object({
      status: z.literal("success"),
      result: resultSchema,
    }),
    z.object({
      status: z.literal("error"),
      error: z.string(),
    }),
    z.object({
      status: z.literal("unsupported"),
    }),
  ]);
}

export const dynamicCapabilitiesMatchingAckSchema = buildAckSchema(
  dynamicCapabilitiesMatchingResponseSchema,
);

// ============================================================================
// Types
// ============================================================================

export type DynamicCapabilitiesMatchingPayload = z.infer<
  typeof dynamicCapabilitiesMatchingPayloadSchema
>;
export type DynamicCapabilitiesMatchingResponse = z.infer<
  typeof dynamicCapabilitiesMatchingResponseSchema
>;
export type DynamicCapabilitiesMatchingAck = z.infer<
  typeof dynamicCapabilitiesMatchingAckSchema
>;
