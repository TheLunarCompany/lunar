import { z } from "zod/v4";
import { webappBoundAckSchema } from "../shared/ack.js";

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

export const storeDownstreamSessionAckSchema = webappBoundAckSchema({});

export type StoreDownstreamSessionAck = z.infer<
  typeof storeDownstreamSessionAckSchema
>;

export const loadDownstreamSessionPayloadSchema = z.object({
  sessionId: z.string(),
});

export const loadDownstreamSessionAckSchema = webappBoundAckSchema({
  data: persistedDownstreamSessionDataSchema.optional(),
});

export type LoadDownstreamSessionAck = z.infer<
  typeof loadDownstreamSessionAckSchema
>;

export const deleteDownstreamSessionPayloadSchema = z.object({
  sessionId: z.string(),
});

export const deleteDownstreamSessionAckSchema = webappBoundAckSchema({});

export type DeleteDownstreamSessionAck = z.infer<
  typeof deleteDownstreamSessionAckSchema
>;

// The Hub derives the owner from the socket, so the request has no payload.
export const listDownstreamSessionsPayloadSchema = z.object({});

export const persistedDownstreamSessionEntrySchema = z.object({
  sessionId: z.string(),
  data: persistedDownstreamSessionDataSchema,
});

export type PersistedDownstreamSessionEntryWire = z.infer<
  typeof persistedDownstreamSessionEntrySchema
>;

export const listDownstreamSessionsAckSchema = webappBoundAckSchema({
  sessions: z.array(persistedDownstreamSessionEntrySchema),
});

export type ListDownstreamSessionsAck = z.infer<
  typeof listDownstreamSessionsAckSchema
>;
