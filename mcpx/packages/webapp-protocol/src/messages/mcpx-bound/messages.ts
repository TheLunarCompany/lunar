import z from "zod/v4";
import { EnvelopedMessage } from "../metadata.js";
import { applyProfilePayloadSchema } from "./apply-profile.js";

// Raw payload schemas
export const McpxBoundPayloads = {
  applyProfile: applyProfilePayloadSchema,
} as const;

export type McpxBoundPayload =
  (typeof McpxBoundPayloads)[keyof typeof McpxBoundPayloads];

export const MCPX_BOUND_EVENTS = {
  APPLY_PROFILE: "apply-profile",
} as const;

export type McpxBoundEventName =
  (typeof MCPX_BOUND_EVENTS)[keyof typeof MCPX_BOUND_EVENTS];

// This maps the kebab-case event names to their payload schemas (raw payloads)
export type McpxBoundPayloadOf<E extends McpxBoundEventName> =
  E extends typeof MCPX_BOUND_EVENTS.APPLY_PROFILE
    ? z.input<typeof applyProfilePayloadSchema>
    : never;

// This maps the kebab-case event names to their enveloped message types
export type McpxBoundEnvelopedOf<E extends McpxBoundEventName> =
  EnvelopedMessage<McpxBoundPayloadOf<E>>;
