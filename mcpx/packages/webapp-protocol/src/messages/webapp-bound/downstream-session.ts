import { z } from "zod/v4";

const wireAdapterSchema = z.object({
  name: z.literal("mcp-remote"),
  version: z.string().optional(),
  support: z.object({ ping: z.boolean() }).optional(),
});

const wireClientInfoSchema = z.object({
  protocolVersion: z.string().optional(),
  name: z.string().optional(),
  version: z.string().optional(),
  title: z.string().optional(),
  websiteUrl: z.string().optional(),
  icons: z
    .array(
      z.object({
        src: z.string(),
        mimeType: z.string().optional(),
        sizes: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  adapter: wireAdapterSchema.optional(),
});

export const persistedDownstreamSessionDataSchema = z.object({
  metadata: z.object({
    consumerTag: z.string().optional(),
    clientId: z.string(),
    llm: z
      .object({
        provider: z.string().optional(),
        modelId: z.string().optional(),
      })
      .optional(),
    clientInfo: wireClientInfoSchema,
    isProbe: z.boolean(),
    authorization: z.string().optional(),
  }),
});

export type PersistedDownstreamSessionDataWire = z.infer<
  typeof persistedDownstreamSessionDataSchema
>;

export const storeDownstreamSessionPayloadSchema = z.object({
  sessionId: z.string(),
  data: persistedDownstreamSessionDataSchema,
});

export const storeDownstreamSessionAckSchema = z.discriminatedUnion("success", [
  z.object({ success: z.literal(true) }),
  z.object({ success: z.literal(false), error: z.string() }),
]);

export type StoreDownstreamSessionAck = z.infer<
  typeof storeDownstreamSessionAckSchema
>;

export const loadDownstreamSessionPayloadSchema = z.object({
  sessionId: z.string(),
});

export const loadDownstreamSessionAckSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    data: persistedDownstreamSessionDataSchema.optional(),
  }),
  z.object({ success: z.literal(false), error: z.string() }),
]);

export type LoadDownstreamSessionAck = z.infer<
  typeof loadDownstreamSessionAckSchema
>;

export const deleteDownstreamSessionPayloadSchema = z.object({
  sessionId: z.string(),
});

export const deleteDownstreamSessionAckSchema = z.discriminatedUnion(
  "success",
  [
    z.object({ success: z.literal(true) }),
    z.object({ success: z.literal(false), error: z.string() }),
  ],
);

export type DeleteDownstreamSessionAck = z.infer<
  typeof deleteDownstreamSessionAckSchema
>;
