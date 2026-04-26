import z from "zod/v4";
import { EnvelopedMessage } from "../metadata.js";
import { setupChangePayloadSchema } from "./setup-change.js";
import { usageStatsPayloadSchema } from "./usage-stats.js";
import { oauthAuthorizationRequiredPayloadSchema } from "./oauth-authorization-required.js";
import { saveSetupPayloadSchema } from "./save-setup.js";
import { deleteSavedSetupPayloadSchema } from "./delete-saved-setup.js";
import { updateSavedSetupPayloadSchema } from "./update-saved-setup.js";
import { dynamicCapabilitiesMatchingPayloadSchema } from "./llm-completion.js";
import { toolCallBatchPayloadSchema } from "./tool-call-batch.js";
import {
  saveOAuthTokenPayloadSchema,
  loadOAuthTokenPayloadSchema,
  deleteOAuthTokensPayloadSchema,
} from "./oauth-token.js";

// Raw payload schemas
export const WebappBoundPayloads = {
  setupChange: setupChangePayloadSchema,
  usageStats: usageStatsPayloadSchema,
  oauthAuthorizationRequired: oauthAuthorizationRequiredPayloadSchema,
  saveSetup: saveSetupPayloadSchema,
  deleteSavedSetup: deleteSavedSetupPayloadSchema,
  updateSavedSetup: updateSavedSetupPayloadSchema,
  dynamicCapabilitiesMatching: dynamicCapabilitiesMatchingPayloadSchema,
  toolCallBatch: toolCallBatchPayloadSchema,
  saveOAuthToken: saveOAuthTokenPayloadSchema,
  loadOAuthToken: loadOAuthTokenPayloadSchema,
  deleteOAuthTokens: deleteOAuthTokensPayloadSchema,
} as const;

export type WebappBoundPayload =
  (typeof WebappBoundPayloads)[keyof typeof WebappBoundPayloads];

export const WEBAPP_BOUND_EVENTS = {
  SETUP_CHANGE: "setup-change",
  USAGE_STATS: "usage-stats",
  OAUTH_AUTHORIZATION_REQUIRED: "oauth-authorization-required",
  SAVE_SETUP: "save-setup",
  LIST_SAVED_SETUPS: "list-saved-setups",
  DELETE_SAVED_SETUP: "delete-saved-setup",
  UPDATE_SAVED_SETUP: "update-saved-setup",
  DYNAMIC_CAPABILITIES_MATCHING: "dynamic-capabilities-matching",
  TOOL_CALL_BATCH: "tool-call-batch",
  SAVE_OAUTH_TOKEN: "save-oauth-token",
  LOAD_OAUTH_TOKEN: "load-oauth-token",
  DELETE_OAUTH_TOKENS: "delete-oauth-tokens",
} as const;

export type WebappBoundEventName =
  (typeof WEBAPP_BOUND_EVENTS)[keyof typeof WEBAPP_BOUND_EVENTS];

// This maps the kebab-case event names to their payload schemas (raw payloads)
// TODO: Refactor to use a mapped type instead of nested ternaries
export type WebappBoundPayloadOf<E extends WebappBoundEventName> =
  E extends typeof WEBAPP_BOUND_EVENTS.SETUP_CHANGE
    ? z.input<typeof setupChangePayloadSchema>
    : E extends typeof WEBAPP_BOUND_EVENTS.USAGE_STATS
      ? z.input<typeof usageStatsPayloadSchema>
      : E extends typeof WEBAPP_BOUND_EVENTS.OAUTH_AUTHORIZATION_REQUIRED
        ? z.input<typeof oauthAuthorizationRequiredPayloadSchema>
        : E extends typeof WEBAPP_BOUND_EVENTS.SAVE_SETUP
          ? z.input<typeof saveSetupPayloadSchema>
          : E extends typeof WEBAPP_BOUND_EVENTS.LIST_SAVED_SETUPS
            ? Record<string, never>
            : E extends typeof WEBAPP_BOUND_EVENTS.DELETE_SAVED_SETUP
              ? z.input<typeof deleteSavedSetupPayloadSchema>
              : E extends typeof WEBAPP_BOUND_EVENTS.UPDATE_SAVED_SETUP
                ? z.input<typeof updateSavedSetupPayloadSchema>
                : E extends typeof WEBAPP_BOUND_EVENTS.DYNAMIC_CAPABILITIES_MATCHING
                  ? z.input<typeof dynamicCapabilitiesMatchingPayloadSchema>
                  : E extends typeof WEBAPP_BOUND_EVENTS.TOOL_CALL_BATCH
                    ? z.input<typeof toolCallBatchPayloadSchema>
                    : E extends typeof WEBAPP_BOUND_EVENTS.SAVE_OAUTH_TOKEN
                      ? z.input<typeof saveOAuthTokenPayloadSchema>
                      : E extends typeof WEBAPP_BOUND_EVENTS.LOAD_OAUTH_TOKEN
                        ? z.input<typeof loadOAuthTokenPayloadSchema>
                        : E extends typeof WEBAPP_BOUND_EVENTS.DELETE_OAUTH_TOKENS
                          ? z.input<typeof deleteOAuthTokensPayloadSchema>
                          : never;

// This maps the kebab-case event names to their enveloped message types
export type WebappBoundEnvelopedOf<E extends WebappBoundEventName> =
  EnvelopedMessage<WebappBoundPayloadOf<E>>;
