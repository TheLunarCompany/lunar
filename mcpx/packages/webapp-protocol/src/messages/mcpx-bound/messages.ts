import z from "zod/v4";
import { EnvelopedMessage } from "../metadata.js";
import { applySetupPayloadSchema } from "./apply-setup.js";

// Raw payload schemas
export const McpxBoundPayloads = {
  applySetup: applySetupPayloadSchema,
} as const;

export type McpxBoundPayload =
  (typeof McpxBoundPayloads)[keyof typeof McpxBoundPayloads];

export const MCPX_BOUND_EVENTS = {
  APPLY_SETUP: "apply-setup",
} as const;

export type McpxBoundEventName =
  (typeof MCPX_BOUND_EVENTS)[keyof typeof MCPX_BOUND_EVENTS];

// This maps the kebab-case event names to their payload schemas (raw payloads)
export type McpxBoundPayloadOf<E extends McpxBoundEventName> =
  E extends typeof MCPX_BOUND_EVENTS.APPLY_SETUP
    ? z.input<typeof applySetupPayloadSchema>
    : never;

// This maps the kebab-case event names to their enveloped message types
export type McpxBoundEnvelopedOf<E extends McpxBoundEventName> =
  EnvelopedMessage<McpxBoundPayloadOf<E>>;
