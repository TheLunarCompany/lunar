import { z } from "zod/v4";
import { webappBoundAckSchema } from "../shared/ack.js";

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

export const dynamicCapabilitiesMatchingAckSchema = webappBoundAckSchema({
  result: dynamicCapabilitiesMatchingResponseSchema,
});

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
