import z from "zod/v4";
import { EnvelopedMessage } from "../metadata.js";
import { applySetupPayloadSchema } from "./apply-setup.js";
import { setCatalogPayloadSchema } from "./set-catalog.js";
import { initiateOAuthPayloadSchema } from "./initiate-oauth.js";
import { completeOAuthPayloadSchema } from "./complete-oauth.js";

// Raw payload schemas
export const McpxBoundPayloads = {
  applySetup: applySetupPayloadSchema,
  setCatalog: setCatalogPayloadSchema,
  initiateOAuth: initiateOAuthPayloadSchema,
  completeOAuth: completeOAuthPayloadSchema,
} as const;

export type McpxBoundPayload =
  (typeof McpxBoundPayloads)[keyof typeof McpxBoundPayloads];

export const MCPX_BOUND_EVENTS = {
  APPLY_SETUP: "apply-setup",
  SET_CATALOG: "set-catalog",
  INITIATE_OAUTH: "initiate-oauth",
  COMPLETE_OAUTH: "complete-oauth",
} as const;

export type McpxBoundEventName =
  (typeof MCPX_BOUND_EVENTS)[keyof typeof MCPX_BOUND_EVENTS];

// This maps the kebab-case event names to their payload schemas (raw payloads)
export type McpxBoundPayloadOf<E extends McpxBoundEventName> =
  E extends typeof MCPX_BOUND_EVENTS.APPLY_SETUP
    ? z.input<typeof applySetupPayloadSchema>
    : E extends typeof MCPX_BOUND_EVENTS.SET_CATALOG
      ? z.input<typeof setCatalogPayloadSchema>
      : E extends typeof MCPX_BOUND_EVENTS.INITIATE_OAUTH
        ? z.input<typeof initiateOAuthPayloadSchema>
        : E extends typeof MCPX_BOUND_EVENTS.COMPLETE_OAUTH
          ? z.input<typeof completeOAuthPayloadSchema>
          : never;

// This maps the kebab-case event names to their enveloped message types
export type McpxBoundEnvelopedOf<E extends McpxBoundEventName> =
  EnvelopedMessage<McpxBoundPayloadOf<E>>;
