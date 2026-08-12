import z from "zod/v4";
import { EnvelopedMessage } from "../metadata.js";
import { applySetupPayloadSchema } from "./apply-setup.js";
import { setCatalogPayloadSchema } from "./set-catalog.js";
import { setProfileSecretsPayloadSchema } from "./set-profile-secrets.js";
import { setIdentityPayloadSchema } from "./set-identity.js";
import { initiateOAuthPayloadSchema } from "./initiate-oauth.js";
import { completeOAuthPayloadSchema } from "./complete-oauth.js";
import { setOauthCredentialsPayloadSchema } from "./set-oauth-credentials.js";
import {
  setPersonalSkillsPayloadSchema,
  setPublishedSkillsPayloadSchema,
} from "./set-skills.js";
import { bootCompletePayloadSchema } from "./boot-complete.js";

// Raw payload schemas
export const McpxBoundPayloads = {
  applySetup: applySetupPayloadSchema,
  setCatalog: setCatalogPayloadSchema,
  setProfileSecrets: setProfileSecretsPayloadSchema,
  setOauthCredentials: setOauthCredentialsPayloadSchema,
  setIdentity: setIdentityPayloadSchema,
  initiateOAuth: initiateOAuthPayloadSchema,
  completeOAuth: completeOAuthPayloadSchema,
  setPersonalSkills: setPersonalSkillsPayloadSchema,
  setPublishedSkills: setPublishedSkillsPayloadSchema,
  bootComplete: bootCompletePayloadSchema,
} as const;

export type McpxBoundPayload =
  (typeof McpxBoundPayloads)[keyof typeof McpxBoundPayloads];

export const MCPX_BOUND_EVENTS = {
  APPLY_SETUP: "apply-setup",
  SET_CATALOG: "set-catalog",
  SET_PROFILE_SECRETS: "set-profile-secrets",
  SET_OAUTH_CREDENTIALS: "set-oauth-credentials",
  SET_IDENTITY: "set-identity",
  INITIATE_OAUTH: "initiate-oauth",
  COMPLETE_OAUTH: "complete-oauth",
  SET_PERSONAL_SKILLS: "set-personal-skills",
  SET_PUBLISHED_SKILLS: "set-published-skills",
  BOOT_COMPLETE: "boot-complete",
} as const;

export type McpxBoundEventName =
  (typeof MCPX_BOUND_EVENTS)[keyof typeof MCPX_BOUND_EVENTS];

// Schemas keyed by wire event name; drives the payload types below. Exhaustiveness is
// enforced by the `satisfies`.
export const mcpxBoundSchemasByEvent = {
  [MCPX_BOUND_EVENTS.APPLY_SETUP]: applySetupPayloadSchema,
  [MCPX_BOUND_EVENTS.SET_CATALOG]: setCatalogPayloadSchema,
  [MCPX_BOUND_EVENTS.SET_PROFILE_SECRETS]: setProfileSecretsPayloadSchema,
  [MCPX_BOUND_EVENTS.SET_OAUTH_CREDENTIALS]: setOauthCredentialsPayloadSchema,
  [MCPX_BOUND_EVENTS.SET_IDENTITY]: setIdentityPayloadSchema,
  [MCPX_BOUND_EVENTS.INITIATE_OAUTH]: initiateOAuthPayloadSchema,
  [MCPX_BOUND_EVENTS.COMPLETE_OAUTH]: completeOAuthPayloadSchema,
  [MCPX_BOUND_EVENTS.SET_PERSONAL_SKILLS]: setPersonalSkillsPayloadSchema,
  [MCPX_BOUND_EVENTS.SET_PUBLISHED_SKILLS]: setPublishedSkillsPayloadSchema,
  [MCPX_BOUND_EVENTS.BOOT_COMPLETE]: bootCompletePayloadSchema,
} as const satisfies Record<McpxBoundEventName, z.ZodType>;

// Maps a wire event name to its (raw) payload type.
export type McpxBoundPayloadOf<E extends McpxBoundEventName> = z.input<
  (typeof mcpxBoundSchemasByEvent)[E]
>;

// This maps the kebab-case event names to their enveloped message types
export type McpxBoundEnvelopedOf<E extends McpxBoundEventName> =
  EnvelopedMessage<McpxBoundPayloadOf<E>>;
