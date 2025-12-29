import z from "zod/v4";
import { EnvelopedMessage } from "../metadata.js";
import { setupChangePayloadSchema } from "./setup-change.js";
import { usageStatsPayloadSchema } from "./usage-stats.js";

// Raw payload schemas
export const WebappBoundPayloads = {
  setupChange: setupChangePayloadSchema,
  usageStats: usageStatsPayloadSchema,
} as const;

export type WebappBoundPayload =
  (typeof WebappBoundPayloads)[keyof typeof WebappBoundPayloads];

export const WEBAPP_BOUND_EVENTS = {
  SETUP_CHANGE: "setup-change",
  USAGE_STATS: "usage-stats",
} as const;

export type WebappBoundEventName =
  (typeof WEBAPP_BOUND_EVENTS)[keyof typeof WEBAPP_BOUND_EVENTS];

// This maps the kebab-case event names to their payload schemas (raw payloads)
export type WebappBoundPayloadOf<E extends WebappBoundEventName> =
  E extends typeof WEBAPP_BOUND_EVENTS.SETUP_CHANGE
    ? z.input<typeof setupChangePayloadSchema>
    : E extends typeof WEBAPP_BOUND_EVENTS.USAGE_STATS
      ? z.input<typeof usageStatsPayloadSchema>
      : never;

// This maps the kebab-case event names to their enveloped message types
export type WebappBoundEnvelopedOf<E extends WebappBoundEventName> =
  EnvelopedMessage<WebappBoundPayloadOf<E>>;
