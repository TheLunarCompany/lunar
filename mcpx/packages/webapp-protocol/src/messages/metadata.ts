import { randomUUID } from "crypto";
import z from "zod/v4";

const metadataSchema = z.object({
  id: z.string(),
});

export type Metadata = z.infer<typeof metadataSchema>;

// Wraps a generic payload schema with an envelope containing metadata
export function Envelope<T extends z.ZodTypeAny>(
  payload: T,
): z.ZodObject<{ metadata: typeof metadataSchema; payload: T }, z.core.$strip> {
  return z.object({
    metadata: metadataSchema,
    payload,
  });
}

// Type helper to extract the payload type from an enveloped schema
export type EnvelopedMessage<T> = {
  metadata: Metadata;
  payload: T;
};

// Utility function to wrap a payload with metadata
export function wrapInEnvelope<T>(
  payload: T,
  id?: string,
): EnvelopedMessage<T> {
  return {
    metadata: {
      id: id || randomUUID(),
    },
    payload,
  };
}
