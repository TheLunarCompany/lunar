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
import {
  storeDownstreamSessionPayloadSchema,
  loadDownstreamSessionPayloadSchema,
  deleteDownstreamSessionPayloadSchema,
  listDownstreamSessionsPayloadSchema,
} from "./downstream-session.js";
import {
  saveSkillPayloadSchema,
  updateSkillPayloadSchema,
  deleteSkillPayloadSchema,
  publishSkillPayloadSchema,
  unpublishSkillPayloadSchema,
} from "./author-skill.js";

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
  storeDownstreamSession: storeDownstreamSessionPayloadSchema,
  loadDownstreamSession: loadDownstreamSessionPayloadSchema,
  deleteDownstreamSession: deleteDownstreamSessionPayloadSchema,
  listDownstreamSessions: listDownstreamSessionsPayloadSchema,
  saveSkill: saveSkillPayloadSchema,
  updateSkill: updateSkillPayloadSchema,
  deleteSkill: deleteSkillPayloadSchema,
  publishSkill: publishSkillPayloadSchema,
  unpublishSkill: unpublishSkillPayloadSchema,
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
  STORE_DOWNSTREAM_SESSION: "store-downstream-session",
  LOAD_DOWNSTREAM_SESSION: "load-downstream-session",
  DELETE_DOWNSTREAM_SESSION: "delete-downstream-session",
  LIST_DOWNSTREAM_SESSIONS: "list-downstream-sessions",
  SAVE_SKILL: "save-skill",
  UPDATE_SKILL: "update-skill",
  DELETE_SKILL: "delete-skill",
  PUBLISH_SKILL: "publish-skill",
  UNPUBLISH_SKILL: "unpublish-skill",
} as const;

export type WebappBoundEventName =
  (typeof WEBAPP_BOUND_EVENTS)[keyof typeof WEBAPP_BOUND_EVENTS];

// Schemas keyed by wire event name; drives the payload types below. Exhaustiveness is
// enforced by the `satisfies` — every event must appear except LIST_SAVED_SETUPS, which
// carries no payload and falls through to Record<string, never>.
export const webappBoundSchemasByEvent = {
  [WEBAPP_BOUND_EVENTS.SETUP_CHANGE]: setupChangePayloadSchema,
  [WEBAPP_BOUND_EVENTS.USAGE_STATS]: usageStatsPayloadSchema,
  [WEBAPP_BOUND_EVENTS.OAUTH_AUTHORIZATION_REQUIRED]:
    oauthAuthorizationRequiredPayloadSchema,
  [WEBAPP_BOUND_EVENTS.SAVE_SETUP]: saveSetupPayloadSchema,
  [WEBAPP_BOUND_EVENTS.DELETE_SAVED_SETUP]: deleteSavedSetupPayloadSchema,
  [WEBAPP_BOUND_EVENTS.UPDATE_SAVED_SETUP]: updateSavedSetupPayloadSchema,
  [WEBAPP_BOUND_EVENTS.DYNAMIC_CAPABILITIES_MATCHING]:
    dynamicCapabilitiesMatchingPayloadSchema,
  [WEBAPP_BOUND_EVENTS.TOOL_CALL_BATCH]: toolCallBatchPayloadSchema,
  [WEBAPP_BOUND_EVENTS.SAVE_OAUTH_TOKEN]: saveOAuthTokenPayloadSchema,
  [WEBAPP_BOUND_EVENTS.LOAD_OAUTH_TOKEN]: loadOAuthTokenPayloadSchema,
  [WEBAPP_BOUND_EVENTS.DELETE_OAUTH_TOKENS]: deleteOAuthTokensPayloadSchema,
  [WEBAPP_BOUND_EVENTS.STORE_DOWNSTREAM_SESSION]:
    storeDownstreamSessionPayloadSchema,
  [WEBAPP_BOUND_EVENTS.LOAD_DOWNSTREAM_SESSION]:
    loadDownstreamSessionPayloadSchema,
  [WEBAPP_BOUND_EVENTS.DELETE_DOWNSTREAM_SESSION]:
    deleteDownstreamSessionPayloadSchema,
  [WEBAPP_BOUND_EVENTS.LIST_DOWNSTREAM_SESSIONS]:
    listDownstreamSessionsPayloadSchema,
  [WEBAPP_BOUND_EVENTS.SAVE_SKILL]: saveSkillPayloadSchema,
  [WEBAPP_BOUND_EVENTS.UPDATE_SKILL]: updateSkillPayloadSchema,
  [WEBAPP_BOUND_EVENTS.DELETE_SKILL]: deleteSkillPayloadSchema,
  [WEBAPP_BOUND_EVENTS.PUBLISH_SKILL]: publishSkillPayloadSchema,
  [WEBAPP_BOUND_EVENTS.UNPUBLISH_SKILL]: unpublishSkillPayloadSchema,
} as const satisfies Record<
  Exclude<WebappBoundEventName, typeof WEBAPP_BOUND_EVENTS.LIST_SAVED_SETUPS>,
  z.ZodType
>;

// Maps a wire event name to its (raw) payload type.
export type WebappBoundPayloadOf<E extends WebappBoundEventName> =
  E extends keyof typeof webappBoundSchemasByEvent
    ? z.input<(typeof webappBoundSchemasByEvent)[E]>
    : Record<string, never>;

// This maps the kebab-case event names to their enveloped message types
export type WebappBoundEnvelopedOf<E extends WebappBoundEventName> =
  EnvelopedMessage<WebappBoundPayloadOf<E>>;
